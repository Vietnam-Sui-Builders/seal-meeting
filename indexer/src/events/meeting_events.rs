// Meeting Room Events

use serde::{Deserialize, Serialize};
use sui_indexer_alt_framework::{
    types::base_types::SuiAddress,
    types::base_types::ObjectID,
};

/// RoomCreated event - emitted when a new meeting room is created
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomCreated {
    pub room_id: ObjectID,
    pub host: SuiAddress,
    pub title: Vec<u8>,
    pub created_at: u64,
}

/// RoomStarted event - emitted when a meeting starts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomStarted {
    pub room_id: ObjectID,
    pub started_at: u64,
}

/// RoomEnded event - emitted when a meeting ends
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomEnded {
    pub room_id: ObjectID,
    pub ended_at: u64,
}

/// GuestApproved event - emitted when a guest is approved
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuestApproved {
    pub room_id: ObjectID,
    pub guest: SuiAddress,
    pub approved_by: SuiAddress,
}

/// GuestRevoked event - emitted when a guest approval is revoked
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuestRevoked {
    pub room_id: ObjectID,
    pub guest: SuiAddress,
    pub revoked_by: SuiAddress,
}

/// HostCapGranted event - emitted when a new host capability is granted
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostCapGranted {
    pub room_id: ObjectID,
    pub new_host: SuiAddress,
    pub granted_by: SuiAddress,
}

/// MetadataUpdated event - emitted when room metadata is updated
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetadataUpdated {
    pub room_id: ObjectID,
    pub updated_by: SuiAddress,
}
