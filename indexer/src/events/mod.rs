// Meeting Room events module

pub mod meeting_events;

pub use meeting_events::*;

use anyhow::{Result, Context};
use sui_indexer_alt_framework::types::event::Event;

/// Unified enum for all meeting room events
#[derive(Debug, Clone)]
pub enum MeetingRoomEvent {
    RoomCreated(RoomCreated),
    RoomStarted(RoomStarted),
    RoomEnded(RoomEnded),
    GuestApproved(GuestApproved),
    GuestRevoked(GuestRevoked),
    HostCapGranted(HostCapGranted),
    MetadataUpdated(MetadataUpdated),
}

impl MeetingRoomEvent {
    /// Parse a Sui event into a strongly-typed MeetingRoomEvent
    pub fn from_sui_event(event: &Event) -> Result<Option<Self>> {
        let event_type = event.type_.name.as_str();

        // Use BCS deserialization for type-safe parsing
        let parsed = match event_type {
            "RoomCreated" => {
                let data: RoomCreated = bcs::from_bytes(&event.contents)
                    .context("Failed to deserialize RoomCreated event")?;
                Self::RoomCreated(data)
            }
            "RoomStarted" => {
                let data: RoomStarted = bcs::from_bytes(&event.contents)
                    .context("Failed to deserialize RoomStarted event")?;
                Self::RoomStarted(data)
            }
            "RoomEnded" => {
                let data: RoomEnded = bcs::from_bytes(&event.contents)
                    .context("Failed to deserialize RoomEnded event")?;
                Self::RoomEnded(data)
            }
            "GuestApproved" => {
                let data: GuestApproved = bcs::from_bytes(&event.contents)
                    .context("Failed to deserialize GuestApproved event")?;
                Self::GuestApproved(data)
            }
            "GuestRevoked" => {
                let data: GuestRevoked = bcs::from_bytes(&event.contents)
                    .context("Failed to deserialize GuestRevoked event")?;
                Self::GuestRevoked(data)
            }
            "HostCapGranted" => {
                let data: HostCapGranted = bcs::from_bytes(&event.contents)
                    .context("Failed to deserialize HostCapGranted event")?;
                Self::HostCapGranted(data)
            }
            "MetadataUpdated" => {
                let data: MetadataUpdated = bcs::from_bytes(&event.contents)
                    .context("Failed to deserialize MetadataUpdated event")?;
                Self::MetadataUpdated(data)
            }
            _ => return Ok(None), // Unknown event type
        };

        Ok(Some(parsed))
    }

    /// Get the event type name as a string
    pub fn event_type(&self) -> &'static str {
        match self {
            Self::RoomCreated(_) => "RoomCreated",
            Self::RoomStarted(_) => "RoomStarted",
            Self::RoomEnded(_) => "RoomEnded",
            Self::GuestApproved(_) => "GuestApproved",
            Self::GuestRevoked(_) => "GuestRevoked",
            Self::HostCapGranted(_) => "HostCapGranted",
            Self::MetadataUpdated(_) => "MetadataUpdated",
        }
    }
}
