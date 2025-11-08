// HostCap Move object parser
//
// Extracts fields from HostCap Move struct on-chain

use anyhow::{Context, Result};
use move_core_types::language_storage::StructTag;
use sui_indexer_alt_framework::types::object::Object;
use sui_indexer_alt_framework::types::base_types::ObjectID;
use crate::models::sealmeet::sealmeet::HostCap;

/// Parsed HostCap fields extracted from Move object
#[derive(Debug, Clone)]
pub struct ParsedHostCap {
    pub cap_id: ObjectID,
    pub room_id: ObjectID,
    pub granted_at: u64,
}

/// Extract HostCap fields from a Move object
pub fn extract_host_cap(
    host_cap_type: &StructTag,
    object: &Object,
) -> Result<Option<ParsedHostCap>> {
    // Check if this object is a HostCap type
    let Some(type_) = object.type_() else {
        return Ok(None);
    };

    if !type_.is(host_cap_type) {
        return Ok(None);
    }

    let move_object = object
        .data
        .try_as_move()
        .ok_or_else(|| anyhow::anyhow!("Not a Move object"))?;

    // Deserialize the HostCap struct
    let fields: HostCap = bcs::from_bytes(move_object.contents())
        .context(format!(
            "Failed to deserialize HostCap struct. Object ID: {:?}, Version: {:?}, Contents length: {} bytes",
            object.id(),
            object.version(),
            move_object.contents().len()
        ))?;

    // Convert ObjectId to ObjectID
    let room_id = ObjectID::from(move_types::Address::from(fields.room_id.0));

    Ok(Some(ParsedHostCap {
        cap_id: object.id(),
        room_id,
        granted_at: fields.granted_at,
    }))
}
