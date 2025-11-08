// MeetingMetadata Dynamic Field Parser
//
// Extracts MeetingMetadata from dynamic fields on MeetingRoom objects

use anyhow::{Context, Result};
use move_core_types::language_storage::StructTag;
use sui_indexer_alt_framework::types::object::Object;
use sui_indexer_alt_framework::types::base_types::ObjectID;
use crate::models::sealmeet::sealmeet::MeetingMetadata;
use crate::utils::BlobId;

/// Parsed MeetingMetadata fields extracted from dynamic field
#[derive(Debug, Clone)]
pub struct ParsedMeetingMetadata {
    pub dynamic_field_id: ObjectID,
    pub df_version: u64,
    pub room_id: ObjectID,
    pub language: String,
    pub timezone: String,
    pub recording_blob_id: Option<BlobId>, // Use BlobId for proper u256 handling
}

/// Extract MeetingMetadata from a dynamic field object
/// Dynamic fields in Sui are stored as separate objects with type DynamicField<K, V>
pub fn extract_meeting_metadata(
    metadata_type: &StructTag,
    object: &Object,
    room_id: ObjectID,
) -> Result<Option<ParsedMeetingMetadata>> {
    // Check if this object is a DynamicField with MeetingMetadata as value type
    let Some(type_) = object.type_() else {
        return Ok(None);
    };

    if !type_.is(metadata_type) {
        return Ok(None);
    }

    let move_object = object
        .data
        .try_as_move()
        .ok_or_else(|| anyhow::anyhow!("Not a Move object"))?;

    // For dynamic fields, the structure is DynamicField<K, V> where:
    // - K is the key type (vector<u8> for b"metadata")
    // - V is the value type (MeetingMetadata)
    // The Move struct has fields: { id: UID, name: K, value: V }

    // We need to deserialize the DynamicField wrapper to get the inner MeetingMetadata
    #[derive(serde::Deserialize)]
    struct DynamicFieldWrapper {
        #[allow(dead_code)]
        id: move_types::ObjectId,
        #[allow(dead_code)]
        name: Vec<u8>, // Should be b"metadata"
        value: MeetingMetadata,
    }

    let wrapper: DynamicFieldWrapper = bcs::from_bytes(move_object.contents())
        .context(format!(
            "Failed to deserialize DynamicField<vector<u8>, MeetingMetadata>. Object ID: {:?}, Version: {:?}",
            object.id(),
            object.version()
        ))?;

    let metadata = wrapper.value;

    // Convert Option<u256> to Option<BlobId>
    // u256 in Move is represented as 32 bytes, which we wrap in BlobId
    let recording_blob_id = metadata.recording_blob_id.map(|u256| {
        // Convert move_types::U256 to [u8; 32] (little-endian bytes)
        BlobId::new(u256.to_le_bytes())
    });

    Ok(Some(ParsedMeetingMetadata {
        dynamic_field_id: object.id(),
        df_version: object.version().into(),
        room_id,
        language: metadata.language,
        timezone: metadata.timezone,
        recording_blob_id,
    }))
}
