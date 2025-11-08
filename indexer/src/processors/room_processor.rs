// Room Processor - Handles MeetingRoom and participant tracking

use std::sync::Arc;
use std::collections::{HashMap, HashSet};
use anyhow::Result;
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use sui_indexer_alt_framework::{
    pipeline::{Processor, sequential::Handler},
    postgres,
    types::full_checkpoint_content::CheckpointData,
    types::base_types::ObjectID,
    types::parse_sui_struct_tag,
    FieldCount,
};
use move_core_types::language_storage::StructTag;

use crate::utils::{checkpoint_input_objects, checkpoint_output_objects, extract_meeting_room, extract_host_cap};
use crate::events::MeetingRoomEvent;
use crate::db::models::{NewMeetingRoom, NewRoomParticipant};
use crate::db::schema::{meeting_rooms, room_participants};

/// Enum representing the data of interest transformed from processing
#[derive(Debug, Clone)]
pub enum ProcessedValue {
    /// Upsert a MeetingRoom
    RoomUpsert {
        room_id: String,
        title: String,
        hosts: Vec<String>,
        participants: Vec<String>,
        seal_policy_id: String,
        status: i16,
        max_participants: i64,
        require_approval: bool,
        created_at: i64,
        started_at: Option<i64>,
        ended_at: Option<i64>,
    },
    /// Delete a MeetingRoom
    RoomDelete(String),
    /// Add/update participant
    ParticipantUpsert {
        room_id: String,
        participant_address: String,
        role: String,
        admin_cap_id: Option<String>,
    },
    /// Remove participant
    ParticipantDelete {
        room_id: String,
        participant_address: String,
    },
}

impl FieldCount for ProcessedValue {
    const FIELD_COUNT: usize = 13;
}

pub struct RoomProcessor {
    package_id: String,
    meeting_room_type: StructTag,
    host_cap_type: StructTag,
}

impl RoomProcessor {
    pub fn new(package_id: String) -> Result<Self> {
        let meeting_room_type = parse_sui_struct_tag(&format!(
            "{}::sealmeet::MeetingRoom",
            package_id
        ))?;
        
        let host_cap_type = parse_sui_struct_tag(&format!(
            "{}::sealmeet::HostCap",
            package_id
        ))?;

        Ok(Self {
            package_id,
            meeting_room_type,
            host_cap_type,
        })
    }
}

impl Processor for RoomProcessor {
    const NAME: &'static str = "room_processor";
    type Value = ProcessedValue;

    fn process(&self, checkpoint: &Arc<CheckpointData>) -> Result<Vec<Self::Value>> {
        let checkpoint_input_objs = checkpoint_input_objects(checkpoint)?;
        let latest_live_output_objs = checkpoint_output_objects(checkpoint)?;
        
        let mut values = Vec::new();
        
        // Track HostCap objects to link them to host addresses
        let mut host_cap_map: HashMap<ObjectID, String> = HashMap::new(); // room_id -> cap_id
        
        for (_object_id, object) in &latest_live_output_objs {
            if let Some(host_cap) = extract_host_cap(&self.host_cap_type, object)? {
                host_cap_map.insert(host_cap.room_id, host_cap.cap_id.to_string());
            }
        }

        // Process MeetingRoom deletions
        for (object_id, object) in &checkpoint_input_objs {
            if latest_live_output_objs.contains_key(object_id) {
                continue;
            }

            if extract_meeting_room(&self.meeting_room_type, object)?.is_none() {
                continue;
            }

            values.push(ProcessedValue::RoomDelete(object_id.to_string()));
        }

        // Process MeetingRoom live objects
        for (_object_id, object) in &latest_live_output_objs {
            let Some(room) = extract_meeting_room(&self.meeting_room_type, object)? else {
                continue;
            };

            let room_id_str = room.object_id.to_string();
            
            let hosts_strings: Vec<String> = room.hosts
                .iter()
                .map(|addr| addr.to_string())
                .collect();
            
            let participants_strings: Vec<String> = room.participants
                .iter()
                .map(|addr| addr.to_string())
                .collect();

            let started_at = if room.started_at > 0 { Some(room.started_at as i64) } else { None };
            let ended_at = if room.ended_at > 0 { Some(room.ended_at as i64) } else { None };

            // Upsert the room
            values.push(ProcessedValue::RoomUpsert {
                room_id: room_id_str.clone(),
                title: room.title,
                hosts: hosts_strings.clone(),
                participants: participants_strings.clone(),
                seal_policy_id: room.seal_policy_id.to_string(),
                status: room.status as i16,
                max_participants: room.max_participants as i64,
                require_approval: room.require_approval,
                created_at: room.created_at as i64,
                started_at,
                ended_at,
            });

            // Sync participants from object state
            // HOSTs
            for host_addr in &hosts_strings {
                let admin_cap_id = host_cap_map.get(&room.object_id).cloned();
                values.push(ProcessedValue::ParticipantUpsert {
                    room_id: room_id_str.clone(),
                    participant_address: host_addr.clone(),
                    role: "HOST".to_string(),
                    admin_cap_id,
                });
            }
            
            // PARTICIPANTs (all participants minus hosts)
            let host_set: HashSet<_> = hosts_strings.iter().collect();
            for participant_addr in &participants_strings {
                if !host_set.contains(participant_addr) {
                    values.push(ProcessedValue::ParticipantUpsert {
                        room_id: room_id_str.clone(),
                        participant_address: participant_addr.clone(),
                        role: "PARTICIPANT".to_string(),
                        admin_cap_id: None,
                    });
                }
            }
        }

        // Process events for additional tracking
        for tx in &checkpoint.transactions {
            let Some(tx_events) = &tx.events else {
                continue;
            };

            for event in &tx_events.data {
                if !event.package_id.to_string().starts_with(&self.package_id) {
                    continue;
                }

                let Some(parsed) = MeetingRoomEvent::from_sui_event(event)? else {
                    continue;
                };

                match parsed {
                    MeetingRoomEvent::HostCapGranted(_granted) => {
                        // Note: HostCap tracking is done via object scanning above
                        // This event could be used for historical tracking if needed
                    }
                    MeetingRoomEvent::GuestRevoked(revoked) => {
                        // Remove participant
                        values.push(ProcessedValue::ParticipantDelete {
                            room_id: revoked.room_id.to_string(),
                            participant_address: revoked.guest.to_string(),
                        });
                    }
                    _ => {}
                }
            }
        }

        Ok(values)
    }
}

#[async_trait::async_trait]
impl Handler for RoomProcessor {
    type Store = postgres::Db;
    type Batch = Vec<ProcessedValue>;

    fn batch(batch: &mut Self::Batch, values: Vec<Self::Value>) {
        batch.extend(values);
    }

    async fn commit<'a>(batch: &Self::Batch, conn: &mut postgres::Connection<'a>) -> Result<usize> {
        let mut total_affected = 0;

        // Separate by type
        let mut rooms_to_upsert = Vec::new();
        let mut rooms_to_delete = Vec::new();
        let mut participants_to_upsert = Vec::new();
        let mut participants_to_delete = Vec::new();

        for value in batch {
            match value {
                ProcessedValue::RoomUpsert { .. } => rooms_to_upsert.push(value),
                ProcessedValue::RoomDelete(_) => rooms_to_delete.push(value),
                ProcessedValue::ParticipantUpsert { .. } => participants_to_upsert.push(value),
                ProcessedValue::ParticipantDelete { .. } => participants_to_delete.push(value),
            }
        }

        // Delete rooms first (CASCADE will delete participants)
        if !rooms_to_delete.is_empty() {
            let room_ids: Vec<String> = rooms_to_delete
                .iter()
                .filter_map(|v| {
                    if let ProcessedValue::RoomDelete(id) = v {
                        Some(id.clone())
                    } else {
                        None
                    }
                })
                .collect();

            let deleted = diesel::delete(meeting_rooms::table)
                .filter(meeting_rooms::room_id.eq_any(room_ids))
                .execute(conn)
                .await?;
            total_affected += deleted;
        }

        // Upsert rooms
        if !rooms_to_upsert.is_empty() {
            for value in rooms_to_upsert {
                if let ProcessedValue::RoomUpsert {
                    room_id,
                    title,
                    hosts,
                    participants,
                    seal_policy_id,
                    status,
                    max_participants,
                    require_approval,
                    created_at,
                    started_at,
                    ended_at,
                } = value {
                    let participant_count = participants.len() as i32;
                    
                    let affected = diesel::insert_into(meeting_rooms::table)
                        .values(&NewMeetingRoom {
                            room_id: room_id.clone(),
                            title: title.clone(),
                            hosts: hosts.clone(),
                            seal_policy_id: seal_policy_id.clone(),
                            status: *status,
                            max_participants: *max_participants,
                            require_approval: *require_approval,
                            participant_count,
                            created_at: *created_at,
                            started_at: *started_at,
                            ended_at: *ended_at,
                            checkpoint_sequence_number: 0,
                            transaction_digest: String::new(),
                        })
                        .on_conflict(meeting_rooms::room_id)
                        .do_update()
                        .set((
                            meeting_rooms::title.eq(title),
                            meeting_rooms::hosts.eq(hosts),
                            meeting_rooms::seal_policy_id.eq(seal_policy_id),
                            meeting_rooms::status.eq(status),
                            meeting_rooms::max_participants.eq(max_participants),
                            meeting_rooms::require_approval.eq(require_approval),
                            meeting_rooms::participant_count.eq(participant_count),
                            meeting_rooms::started_at.eq(started_at),
                            meeting_rooms::ended_at.eq(ended_at),
                            meeting_rooms::updated_at.eq(diesel::dsl::now),
                        ))
                        .execute(conn)
                        .await?;
                    total_affected += affected;
                }
            }
        }

        // Delete participants
        if !participants_to_delete.is_empty() {
            for value in participants_to_delete {
                if let ProcessedValue::ParticipantDelete { room_id, participant_address } = value {
                    let deleted = diesel::delete(room_participants::table)
                        .filter(room_participants::room_id.eq(room_id))
                        .filter(room_participants::participant_address.eq(participant_address))
                        .execute(conn)
                        .await?;
                    total_affected += deleted;
                }
            }
        }

        // Upsert participants
        if !participants_to_upsert.is_empty() {
            for value in participants_to_upsert {
                if let ProcessedValue::ParticipantUpsert {
                    room_id,
                    participant_address,
                    role,
                    admin_cap_id,
                } = value {
                    let affected = diesel::insert_into(room_participants::table)
                        .values(&NewRoomParticipant {
                            room_id: room_id.clone(),
                            participant_address: participant_address.clone(),
                            role: role.clone(),
                            admin_cap_id: admin_cap_id.clone(),
                        })
                        .on_conflict((room_participants::room_id, room_participants::participant_address))
                        .do_update()
                        .set((
                            room_participants::role.eq(role),
                            room_participants::admin_cap_id.eq(admin_cap_id),
                            room_participants::updated_at.eq(diesel::dsl::now),
                        ))
                        .execute(conn)
                        .await?;
                    total_affected += affected;
                }
            }
        }

        Ok(total_affected)
    }
}
