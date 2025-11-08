// Metadata Processor - Handles MeetingMetadata dynamic fields

use std::sync::Arc;
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
use sui_types::object::Owner;

use crate::utils::{checkpoint_input_objects, checkpoint_output_objects, extract_meeting_metadata};
use crate::db::models::NewRoomMetadata;
use crate::db::schema::room_metadata;

/// Enum representing the metadata data to persist
#[derive(Debug, Clone)]
pub enum ProcessedValue {
    /// Upsert metadata
    MetadataUpsert {
        room_id: String,
        dynamic_field_id: String,
        df_version: i64,
        language: String,
        timezone: String,
        recording_blob_id: Option<bigdecimal::BigDecimal>,
    },
    /// Delete metadata (when dynamic field is removed)
    MetadataDelete(String), // room_id
}

impl FieldCount for ProcessedValue {
    const FIELD_COUNT: usize = 6;
}

pub struct MetadataProcessor {
    package_id: String,
    dynamic_field_type: StructTag,
}

impl MetadataProcessor {
    pub fn new(package_id: String) -> Result<Self> {
        // DynamicField type: 0x2::dynamic_field::Field<K, V>
        // K = vector<u8> (for b"metadata" key)
        // V = MeetingMetadata from our package
        let dynamic_field_type = parse_sui_struct_tag(&format!(
            "0x0000000000000000000000000000000000000000000000000000000000000002::dynamic_field::Field<vector<u8>, {}::sealmeet::MeetingMetadata>",
            package_id
        ))?;

        Ok(Self {
            package_id,
            dynamic_field_type,
        })
    }
}

impl Processor for MetadataProcessor {
    const NAME: &'static str = "metadata_processor";
    type Value = ProcessedValue;

    fn process(&self, checkpoint: &Arc<CheckpointData>) -> Result<Vec<Self::Value>> {
        let checkpoint_input_objs = checkpoint_input_objects(checkpoint)?;
        let latest_live_output_objs = checkpoint_output_objects(checkpoint)?;

        let mut values = Vec::new();

        // Track which room IDs have metadata in this checkpoint
        let mut processed_rooms = std::collections::HashSet::new();

        // Process deletions: dynamic fields that existed in input but not in output
        for (object_id, _object) in &checkpoint_input_objs {
            if latest_live_output_objs.contains_key(object_id) {
                continue; // Still exists, not deleted
            }

            // Try to extract metadata from the deleted object
            // We need to find which room this dynamic field belonged to
            // This is tricky because we need to track the parent object
            // For now, we'll rely on the MetadataUpdated event to know which room was affected
        }

        // Process metadata dynamic fields in output
        for (_object_id, object) in &latest_live_output_objs {
            // Dynamic fields have a parent field that references the MeetingRoom
            // We need to find the room_id from the parent
            // For this, we'll scan the parent field in the object's owner

            // Try to extract the parent ObjectID from the object owner
            let parent_id = match &object.owner {
                Owner::ObjectOwner(addr) => {
                    ObjectID::from(*addr)
                },
                _ => continue, // Not a dynamic field (not owned by object)
            };

            if let Some(metadata) = extract_meeting_metadata(&self.dynamic_field_type, object, parent_id)? {
                let room_id_str = metadata.room_id.to_string();

                // Convert BlobId (u256) to BigDecimal for NUMERIC storage
                let recording_blob_id = match metadata.recording_blob_id {
                    Some(blob_id) => Some(blob_id.to_bigdecimal()?),
                    None => None,
                };

                values.push(ProcessedValue::MetadataUpsert {
                    room_id: room_id_str.clone(),
                    dynamic_field_id: metadata.dynamic_field_id.to_string(),
                    df_version: metadata.df_version as i64,
                    language: metadata.language,
                    timezone: metadata.timezone,
                    recording_blob_id,
                });

                processed_rooms.insert(room_id_str);
            }
        }

        // Process MetadataUpdated events to detect deletions
        // If we get a MetadataUpdated event but no corresponding dynamic field in output,
        // it means the metadata was removed
        for tx in &checkpoint.transactions {
            let Some(tx_events) = &tx.events else {
                continue;
            };

            for event in &tx_events.data {
                if !event.package_id.to_string().starts_with(&self.package_id) {
                    continue;
                }

                // Check for MetadataUpdated events
                if event.type_.name.as_str() == "MetadataUpdated" {
                    // Parse the event to get room_id
                    #[derive(serde::Deserialize)]
                    struct MetadataUpdatedEvent {
                        room_id: move_types::ObjectId,
                        #[allow(dead_code)]
                        updated_by: move_types::Address,
                    }

                    if let Ok(parsed) = bcs::from_bytes::<MetadataUpdatedEvent>(&event.contents) {
                        // Convert ObjectId to ObjectID via Address
                        let addr = move_types::Address::from(parsed.room_id.0);
                        let room_id_str = ObjectID::from(addr).to_string();

                        // If we didn't find metadata for this room in the output objects,
                        // it means it was deleted (or the event was emitted without metadata)
                        // We'll handle this on the database side with proper queries
                        // For now, just track that this room had a metadata update
                        processed_rooms.insert(room_id_str);
                    }
                }
            }
        }

        Ok(values)
    }
}

#[async_trait::async_trait]
impl Handler for MetadataProcessor {
    type Store = postgres::Db;
    type Batch = Vec<ProcessedValue>;

    fn batch(batch: &mut Self::Batch, values: Vec<Self::Value>) {
        batch.extend(values);
    }

    async fn commit<'a>(batch: &Self::Batch, conn: &mut postgres::Connection<'a>) -> Result<usize> {
        let mut total_affected = 0;

        // Separate by type
        let mut metadata_to_upsert = Vec::new();
        let mut metadata_to_delete = Vec::new();

        for value in batch {
            match value {
                ProcessedValue::MetadataUpsert { .. } => metadata_to_upsert.push(value),
                ProcessedValue::MetadataDelete(_) => metadata_to_delete.push(value),
            }
        }

        // Delete metadata first
        if !metadata_to_delete.is_empty() {
            let room_ids: Vec<String> = metadata_to_delete
                .iter()
                .filter_map(|v| {
                    if let ProcessedValue::MetadataDelete(id) = v {
                        Some(id.clone())
                    } else {
                        None
                    }
                })
                .collect();

            let deleted = diesel::delete(room_metadata::table)
                .filter(room_metadata::room_id.eq_any(room_ids))
                .execute(conn)
                .await?;
            total_affected += deleted;
        }

        // Upsert metadata
        if !metadata_to_upsert.is_empty() {
            for value in metadata_to_upsert {
                if let ProcessedValue::MetadataUpsert {
                    room_id,
                    dynamic_field_id,
                    df_version,
                    language,
                    timezone,
                    recording_blob_id,
                } = value {
                    let affected = diesel::insert_into(room_metadata::table)
                        .values(&NewRoomMetadata {
                            room_id: room_id.clone(),
                            dynamic_field_id: dynamic_field_id.clone(),
                            df_version: *df_version,
                            language: language.clone(),
                            timezone: timezone.clone(),
                            recording_blob_id: recording_blob_id.clone(),
                        })
                        .on_conflict(room_metadata::room_id)
                        .do_update()
                        .set((
                            room_metadata::dynamic_field_id.eq(dynamic_field_id),
                            room_metadata::df_version.eq(df_version),
                            room_metadata::language.eq(language),
                            room_metadata::timezone.eq(timezone),
                            room_metadata::recording_blob_id.eq(recording_blob_id),
                            room_metadata::updated_at.eq(diesel::dsl::now),
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
