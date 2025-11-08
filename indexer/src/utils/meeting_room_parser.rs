// MeetingRoom Move object parser
//
// Extracts fields from MeetingRoom Move struct on-chain

use anyhow::{Context, Result};
use move_core_types::language_storage::StructTag;
use sui_indexer_alt_framework::types::object::Object;
use sui_indexer_alt_framework::types::base_types::{ObjectID, SuiAddress, SequenceNumber};
use sui_indexer_alt_framework::types::effects::TransactionEffectsAPI;
use sui_indexer_alt_framework::types::full_checkpoint_content::CheckpointData;
use std::collections::{BTreeMap, HashSet};
use std::collections::btree_map::Entry;
use crate::models::sealmeet::sealmeet::MeetingRoom;

/// Parsed MeetingRoom fields extracted from Move object
#[derive(Debug, Clone)]
pub struct ParsedMeetingRoom {
    pub object_id: ObjectID,
    pub title: String,
    pub description: Option<String>,
    pub hosts: Vec<SuiAddress>,
    pub participants: Vec<SuiAddress>,
    pub max_participants: u64,
    pub require_approval: bool,
    pub seal_policy_id: ObjectID,
    pub status: u8,
    pub created_at: u64,
    pub started_at: u64,
    pub ended_at: u64,
}

/// Extract MeetingRoom fields from a Move object
pub fn extract_meeting_room(
    meeting_room_type: &StructTag,
    object: &Object,
) -> Result<Option<ParsedMeetingRoom>> {
    // Check if this object is a MeetingRoom type
    let Some(type_) = object.type_() else {
        return Ok(None);
    };

    if !type_.is(meeting_room_type) {
        return Ok(None);
    }

    let move_object = object
        .data
        .try_as_move()
        .ok_or_else(|| anyhow::anyhow!("Not a Move object"))?;

    // Deserialize the MeetingRoom struct
    let fields: MeetingRoom = bcs::from_bytes(move_object.contents())
        .context(format!(
            "Failed to deserialize MeetingRoom struct. Object ID: {:?}, Version: {:?}, Contents length: {} bytes. \
             This usually means the Move contract struct layout changed.",
            object.id(),
            object.version(),
            move_object.contents().len()
        ))?;

    // The generated bindings already have String as Rust String
    let title = fields.title;
    let description = fields.description;

    // Convert hosts and participants from move_types::Address to SuiAddress
    let hosts: Vec<SuiAddress> = fields.hosts
        .into_iter()
        .map(|addr| SuiAddress::from(addr))
        .collect();

    let participants: Vec<SuiAddress> = fields.participants
        .into_iter()
        .map(|addr| SuiAddress::from(addr))
        .collect();

    // Convert ObjectId to ObjectID - ObjectId contains inner bytes
    let seal_policy_id = ObjectID::from(move_types::Address::from(fields.seal_policy_id.0));

    Ok(Some(ParsedMeetingRoom {
        object_id: object.id(),
        title,
        description,
        hosts,
        participants,
        max_participants: fields.max_participants,
        require_approval: fields.require_approval,
        seal_policy_id,
        status: fields.status,
        created_at: fields.created_at,
        started_at: fields.started_at,
        ended_at: fields.ended_at,
    }))
}

/// Returns the first appearance of all objects that were used as inputs to the transactions in the
/// checkpoint. These are objects that existed prior to the checkpoint, and excludes objects that
/// were created or unwrapped within the checkpoint.
pub fn checkpoint_input_objects(
    checkpoint: &CheckpointData,
) -> Result<BTreeMap<ObjectID, &Object>> {
    let mut output_objects_seen = HashSet::new();
    let mut checkpoint_input_objects = BTreeMap::new();
    
    for tx in &checkpoint.transactions {
        let input_objects_map: BTreeMap<(ObjectID, SequenceNumber), &Object> = tx
            .input_objects
            .iter()
            .map(|obj| ((obj.id(), obj.version()), obj))
            .collect();

        for change in tx.effects.object_changes() {
            let id = change.id;

            let Some(version) = change.input_version else {
                continue;
            };

            // This object was previously modified, created, or unwrapped in the checkpoint, so
            // this version is not a checkpoint input.
            if output_objects_seen.contains(&id) {
                continue;
            }

            // Make sure this object has not already been recorded as an input.
            let Entry::Vacant(entry) = checkpoint_input_objects.entry(id) else {
                continue;
            };

            let input_obj = input_objects_map
                .get(&(id, version))
                .copied()
                .with_context(|| format!(
                    "Object {id} at version {version} referenced in effects not found in input_objects"
                ))?;

            entry.insert(input_obj);
        }

        for change in tx.effects.object_changes() {
            if change.output_version.is_some() {
                output_objects_seen.insert(change.id);
            }
        }
    }
    
    Ok(checkpoint_input_objects)
}

/// Returns all versions of objects that were output by transactions in the checkpoint, and are
/// still live at the end of the checkpoint.
pub fn checkpoint_output_objects(
    checkpoint: &CheckpointData,
) -> Result<BTreeMap<ObjectID, &Object>> {
    let mut output_objects = BTreeMap::new();
    
    for tx in &checkpoint.transactions {
        let output_objects_map: BTreeMap<_, _> = tx
            .output_objects
            .iter()
            .map(|obj| ((obj.id(), obj.version()), obj))
            .collect();

        for change in tx.effects.object_changes() {
            let id = change.id;

            // Clear the previous entry, in case it was created within this checkpoint.
            output_objects.remove(&id);

            let Some(version) = change.output_version else {
                continue;
            };

            let output_object = output_objects_map
                .get(&(id, version))
                .copied()
                .with_context(|| format!("{id} at {version} in effects, not in output_objects"))?;

            output_objects.insert(id, output_object);
        }
    }

    Ok(output_objects)
}
