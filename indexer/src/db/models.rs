use chrono::NaiveDateTime;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use sui_indexer_alt_framework::FieldCount;

use super::schema::*;

// ===== Queryable Models (for reading from DB) =====

#[derive(Queryable, Selectable, Serialize, Deserialize, Debug, Clone)]
#[diesel(table_name = meeting_rooms)]
pub struct MeetingRoom {
    pub id: i64,
    pub room_id: String,
    pub title: String,
    pub hosts: Vec<String>,
    pub seal_policy_id: String,
    pub status: i16,
    pub max_participants: i64,
    pub require_approval: bool,
    pub participant_count: i32,
    pub created_at: i64,
    pub started_at: Option<i64>,
    pub ended_at: Option<i64>,
    pub checkpoint_sequence_number: i64,
    pub transaction_digest: String,
    pub indexed_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

// ===== Insertable Models (for writing to DB) =====

#[derive(Insertable, Debug, Clone, FieldCount)]
#[diesel(table_name = meeting_rooms)]
pub struct NewMeetingRoom {
    pub room_id: String,
    pub title: String,
    pub hosts: Vec<String>,
    pub seal_policy_id: String,
    pub status: i16,
    pub max_participants: i64,
    pub require_approval: bool,
    pub participant_count: i32,
    pub created_at: i64,
    pub started_at: Option<i64>,
    pub ended_at: Option<i64>,
    pub checkpoint_sequence_number: i64,
    pub transaction_digest: String,
}

// ===== AsChangeset Models (for updates) =====

#[derive(AsChangeset, Debug, Clone)]
#[diesel(table_name = meeting_rooms)]
pub struct MeetingRoomUpdate {
    pub status: Option<i16>,
    pub participant_count: Option<i32>,
    pub started_at: Option<i64>,
    pub ended_at: Option<i64>,
    pub hosts: Option<Vec<String>>,
}

// ===== Room Participants Models =====

#[derive(Queryable, Selectable, Serialize, Deserialize, Debug, Clone)]
#[diesel(table_name = room_participants)]
pub struct RoomParticipant {
    pub id: i64,
    pub room_id: String,
    pub participant_address: String,
    pub role: String,
    pub admin_cap_id: Option<String>,
    pub joined_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Insertable, Debug, Clone, FieldCount)]
#[diesel(table_name = room_participants)]
pub struct NewRoomParticipant {
    pub room_id: String,
    pub participant_address: String,
    pub role: String,
    pub admin_cap_id: Option<String>,
}

// ===== Room Metadata Models =====

#[derive(Queryable, Selectable, Serialize, Deserialize, Debug, Clone)]
#[diesel(table_name = room_metadata)]
pub struct RoomMetadata {
    pub id: i64,
    pub room_id: String,
    pub dynamic_field_id: String,
    pub df_version: i64,
    pub language: String,
    pub timezone: String,
    pub recording_blob_id: Option<bigdecimal::BigDecimal>,
    pub indexed_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Insertable, Debug, Clone, FieldCount)]
#[diesel(table_name = room_metadata)]
pub struct NewRoomMetadata {
    pub room_id: String,
    pub dynamic_field_id: String,
    pub df_version: i64,
    pub language: String,
    pub timezone: String,
    pub recording_blob_id: Option<bigdecimal::BigDecimal>,
}
