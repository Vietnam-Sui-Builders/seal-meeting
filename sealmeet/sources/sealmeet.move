// Advanced SuiMeet with Capability, Option<T>, Dynamic Fields, and Display patterns
module sealmeet::sealmeet;

use sui::clock::{Self, Clock};
use sui::event;
use sui::table::{Self, Table};
use sui::dynamic_field as df;
use sui::display;
use sui::package;
use std::string::{Self, String};
use sealmeet::seal_approve_whitelist::{Self, SealApproveWhitelist};

// ========== One-Time Witness for Display ==========
public struct SEALMEET has drop {}

// ========== Capability Pattern ==========
/// HostCap - Transferable capability proving host status
/// Can be transferred to delegate host powers
public struct HostCap has key, store {
    id: object::UID,
    room_id: object::ID,
    granted_at: u64,
}


// ========== Main Structs with Option<T> ==========

public struct MeetingRoom has key, store {
    id: object::UID,
    title: String,
    description: Option<String>,           // Optional description
    hosts: vector<address>,
    participants: vector<address>,
    max_participants: u64,
    require_approval: bool,
    seal_policy: SealApproveWhitelist,
    seal_policy_id: object::ID,
    status: u8,
    created_at: u64,
    started_at: u64,
    ended_at: u64,

    // Dynamic fields are stored here (see add_metadata)
    // MeetingMetadata with Walrus recording blob ID is stored as dynamic field
}

// ========== Dynamic Field Structures ==========

/// MeetingMetadata - Stored as dynamic field
/// Now includes Walrus blob ID for recording storage
public struct MeetingMetadata has store, copy, drop {
    language: String,
    timezone: String,
    recording_blob_id: Option<u256>,  // Walrus blob for recording
}

// ========== Registry ==========

public struct RoomRegistry has key {
    id: object::UID,
    room_count: u64,
    all_rooms: vector<object::ID>,
    rooms_by_host: Table<address, vector<object::ID>>,
    active_rooms: vector<object::ID>,
    scheduled_rooms: vector<object::ID>,
    rooms_by_seal_id: Table<object::ID, object::ID>,
}

// ========== Events ==========

public struct RoomCreated has copy, drop {
    room_id: object::ID,
    host: address,
    title: String,
    created_at: u64,
}

public struct RoomStarted has copy, drop {
    room_id: object::ID,
    started_at: u64,
}

public struct RoomEnded has copy, drop {
    room_id: object::ID,
    ended_at: u64,
}

public struct HostCapGranted has copy, drop {
    room_id: object::ID,
    new_host: address,
    granted_by: address,
}

public struct MetadataUpdated has copy, drop {
    room_id: object::ID,
    updated_by: address,
}

public struct GuestApproved has copy, drop {
    room_id: object::ID,
    guest: address,
    approved_by: address,
}

public struct GuestRevoked has copy, drop {
    room_id: object::ID,
    guest: address,
    revoked_by: address,
}

// ========== Error Codes ==========
const ERROR_ROOM_ENDED: u64 = 1;
const ERROR_INVALID_CAPABILITY: u64 = 2;
const ERROR_ALREADY_APPROVED: u64 = 3;
const ERROR_NOT_APPROVED: u64 = 4;
const ERROR_ROOM_ALREADY_ACTIVE: u64 = 5;
const ERROR_ALREADY_HOST: u64 = 6;
const ERROR_CANNOT_REVOKE_HOST: u64 = 7;
const ERROR_TOO_MANY_PARTICIPANTS: u64 = 8;
const ERROR_ROOM_FULL: u64 = 9;
const ERROR_INVALID_NUMBER: u64 = 10;

const STATUS_SCHEDULED: u8 = 1;
const STATUS_ACTIVE: u8 = 2;
const STATUS_ENDED: u8 = 3;
const MAX_PARTICIPANTS: u64 = 20;

// ========== Init with Display ==========

fun init(otw: SEALMEET, ctx: &mut tx_context::TxContext) {
    // Create registry
    let registry = RoomRegistry {
        id: object::new(ctx),
        room_count: 0,
        all_rooms: vector::empty<object::ID>(),
        rooms_by_host: table::new<address, vector<object::ID>>(ctx),
        active_rooms: vector::empty<object::ID>(),
        scheduled_rooms: vector::empty<object::ID>(),
        rooms_by_seal_id: table::new<object::ID, object::ID>(ctx),
    };
    transfer::share_object(registry);

    // Set up Display for MeetingRoom
    let publisher = package::claim(otw, ctx);
    let mut display = display::new<MeetingRoom>(&publisher, ctx);

    display::add(&mut display, string::utf8(b"name"), string::utf8(b"{title}"));
    display::add(&mut display, string::utf8(b"description"), string::utf8(b"{description}"));
    display::add(&mut display, string::utf8(b"image_url"), string::utf8(b"https://suimeet.io/api/room-thumbnail/{id}"));
    display::add(&mut display, string::utf8(b"project_url"), string::utf8(b"https://suimeet.io"));
    display::add(&mut display, string::utf8(b"creator"), string::utf8(b"SuiMeet"));

    display::update_version(&mut display);
    transfer::public_transfer(display, tx_context::sender(ctx));
    transfer::public_transfer(publisher, tx_context::sender(ctx));
}

// ========== Room Creation with Option<T> ==========
#[allow(lint(self_transfer))]
public fun create_room(
    registry: &mut RoomRegistry,
    title: vector<u8>,
    description: Option<vector<u8>>,
    max_participants: u64,
    require_approval: bool,
    initial_participants: vector<address>, // Initial participants including host
    clock: &Clock,
    ctx: &mut tx_context::TxContext,
) {
    let sender = tx_context::sender(ctx);

    // Validate max_participants is reasonable
    assert!(max_participants <= MAX_PARTICIPANTS, ERROR_TOO_MANY_PARTICIPANTS);
    assert!(max_participants > 0, ERROR_INVALID_NUMBER);
    // Check for duplicates in initial_participants and validate length
    let mut participants = vector::empty<address>();
    let mut i = 0;
    while (i < vector::length(&initial_participants)) {
        let addr = *vector::borrow(&initial_participants, i);
        // Only add if not already in participants (removes duplicates)
        if (!vector::contains(&participants, &addr)) {
            vector::push_back(&mut participants, addr);
        };
        i = i + 1;
    };

    // Ensure sender is in participants
    if (!vector::contains(&participants, &sender)) {
        vector::push_back(&mut participants, sender);
    };

    // Validate participants doesn't exceed max
    assert!(vector::length(&participants) <= max_participants, ERROR_TOO_MANY_PARTICIPANTS);

    let policy = seal_approve_whitelist::create(participants, ctx);
    let seal_policy_id = policy.policy_id();

    let room_uid = object::new(ctx);
    let room_id = object::uid_to_inner(&room_uid);
    let created_at = clock::timestamp_ms(clock);

    let mut hosts = vector::empty<address>();
    vector::push_back(&mut hosts, sender);

    // Convert Option<vector<u8>> to Option<String>
    let description_string = if (option::is_some(&description)) {
        let mut desc_opt = description;
        let desc_bytes = option::extract(&mut desc_opt);
        option::some(string::utf8(desc_bytes))
    } else {
        option::none<String>()
    };

    let room = MeetingRoom {
        id: room_uid,
        title: string::utf8(title),
        description: description_string,
        hosts,
        participants,
        max_participants,
        require_approval,
        seal_policy: policy,
        seal_policy_id,
        status: STATUS_SCHEDULED,
        created_at,
        started_at: 0,
        ended_at: 0,
    };

    // Update registry
    vector::push_back(&mut registry.all_rooms, room_id);
    vector::push_back(&mut registry.scheduled_rooms, room_id);
    table::add(&mut registry.rooms_by_seal_id, seal_policy_id, room_id);

    if (table::contains(&registry.rooms_by_host, sender)) {
        let host_rooms = table::borrow_mut(&mut registry.rooms_by_host, sender);
        vector::push_back(host_rooms, room_id);
    } else {
        let mut host_rooms = vector::empty<object::ID>();
        vector::push_back(&mut host_rooms, room_id);
        table::add(&mut registry.rooms_by_host, sender, host_rooms);
    };

    event::emit(RoomCreated {
        room_id,
        host: sender,
        title: string::utf8(title),
        created_at,
    });

    registry.room_count = registry.room_count + 1;

    // Create and transfer initial HostCap to room creator
    let host_cap = HostCap {
        id: object::new(ctx),
        room_id,
        granted_at: created_at,
    };
    transfer::transfer(host_cap, sender);

    transfer::share_object(room);
}

// ========== Capability Pattern: Grant Host Powers ==========

/// Grant HostCap to another user - they can manage the room
public fun add_new_host(
    host_cap: &HostCap,
    registry: &mut RoomRegistry,
    room: &mut MeetingRoom,
    new_host: address,
    clock: &Clock,
    ctx: &mut tx_context::TxContext,
) {
    assert!(room.status != STATUS_ENDED, ERROR_ROOM_ENDED);
    assert!(host_cap.room_id == object::uid_to_inner(&room.id), ERROR_INVALID_CAPABILITY);

    // Check new_host is not already a host
    assert!(!vector::contains(&room.hosts, &new_host), ERROR_ALREADY_HOST);

    // Check if already in participants (add to whitelist will fail if duplicate)
    let already_participant = vector::contains(&room.participants, &new_host);

    // Add to whitelist first (can abort, so do before state changes)
    if (!already_participant) {
        seal_approve_whitelist::add_to_whitelist(&mut room.seal_policy, new_host, clock);
    };

    // Now safe to modify room state
    vector::push_back(&mut room.hosts, new_host);

    if (!already_participant) {
        vector::push_back(&mut room.participants, new_host);
    };

    // Update registry rooms_by_host
    let room_id = object::uid_to_inner(&room.id);
    if (table::contains(&registry.rooms_by_host, new_host)) {
        let host_rooms = table::borrow_mut(&mut registry.rooms_by_host, new_host);
        vector::push_back(host_rooms, room_id);
    } else {
        let mut host_rooms = vector::empty<object::ID>();
        vector::push_back(&mut host_rooms, room_id);
        table::add(&mut registry.rooms_by_host, new_host, host_rooms);
    };

    // Create new HostCap for new host
    let new_host_cap = HostCap {
        id: object::new(ctx),
        room_id,
        granted_at: clock::timestamp_ms(clock),
    };

    event::emit(HostCapGranted {
        room_id,
        new_host,
        granted_by: tx_context::sender(ctx),
    });

    transfer::transfer(new_host_cap, new_host);
}

/// Start the room - transition from scheduled to active (requires HostCap)
public fun start_room(
    host_cap: &HostCap,
    registry: &mut RoomRegistry,
    room: &mut MeetingRoom,
    clock: &Clock,
) {
    // Verify capability matches room
    assert!(host_cap.room_id == object::uid_to_inner(&room.id), ERROR_INVALID_CAPABILITY);

    // Check room is scheduled (not already active or ended)
    if (room.status == STATUS_ACTIVE) {
        abort ERROR_ROOM_ALREADY_ACTIVE
    };
    assert!(room.status == STATUS_SCHEDULED, ERROR_ROOM_ENDED);

    let room_id = object::uid_to_inner(&room.id);
    let started_at = clock::timestamp_ms(clock);
    room.status = STATUS_ACTIVE;
    room.started_at = started_at;

    // Update registry - move from scheduled to active
    let (found, idx) = vector::index_of(&registry.scheduled_rooms, &room_id);
    if (found) {
        vector::remove(&mut registry.scheduled_rooms, idx);
    };
    vector::push_back(&mut registry.active_rooms, room_id);

    event::emit(RoomStarted {
        room_id,
        started_at,
    });
}

/// Use HostCap to prove authority (can be transferred/delegated)
public fun end_room(
    host_cap: &HostCap,
    registry: &mut RoomRegistry,
    room: &mut MeetingRoom,
    clock: &Clock,
) {
    // Verify capability matches room
    assert!(host_cap.room_id == object::uid_to_inner(&room.id), ERROR_INVALID_CAPABILITY);
    assert!(room.status != STATUS_ENDED, ERROR_ROOM_ENDED);

    let room_id = object::uid_to_inner(&room.id);
    let ended_at = clock::timestamp_ms(clock);
    room.status = STATUS_ENDED;
    room.ended_at = ended_at;

    // Clean up registry - remove from active or scheduled rooms
    let (found, idx) = vector::index_of(&registry.active_rooms, &room_id);
    if (found) {
        vector::remove(&mut registry.active_rooms, idx);
    } else {
        // Check scheduled_rooms if not in active
        let (found_scheduled, idx_scheduled) = vector::index_of(&registry.scheduled_rooms, &room_id);
        if (found_scheduled) {
            vector::remove(&mut registry.scheduled_rooms, idx_scheduled);
        };
    };

    // Remove from seal_id mapping (ended rooms don't need quick lookup by seal ID)
    if (table::contains(&registry.rooms_by_seal_id, room.seal_policy_id)) {
        table::remove(&mut registry.rooms_by_seal_id, room.seal_policy_id);
    };

    // Note: Keep room in all_rooms and rooms_by_host for historical queries

    event::emit(RoomEnded {
        room_id,
        ended_at,
    });
}

// ========== Dynamic Fields: Metadata ==========

/// Add metadata as dynamic field (can be updated later)
public fun add_metadata(
    host_cap: &HostCap,
    room: &mut MeetingRoom,
    language: vector<u8>,
    timezone: vector<u8>,
    recording_blob_id: Option<u256>,
    ctx: &mut tx_context::TxContext,
) {
    assert!(host_cap.room_id == object::uid_to_inner(&room.id), ERROR_INVALID_CAPABILITY);
    let metadata = MeetingMetadata {
        language: string::utf8(language),
        timezone: string::utf8(timezone),
        recording_blob_id,
    };

    // Store as dynamic field with key "metadata"
    if (df::exists_(&room.id, b"metadata")) {
        df::remove<vector<u8>, MeetingMetadata>(&mut room.id, b"metadata");
    };
    df::add(&mut room.id, b"metadata", metadata);

    event::emit(MetadataUpdated {
        room_id: object::uid_to_inner(&room.id),
        updated_by: tx_context::sender(ctx),
    });
}

/// Get metadata from dynamic field
public fun get_metadata(room: &MeetingRoom): Option<MeetingMetadata> {
    if (df::exists_(&room.id, b"metadata")) {
        let metadata = df::borrow<vector<u8>, MeetingMetadata>(&room.id, b"metadata");
        option::some(*metadata)
    } else {
        option::none<MeetingMetadata>()
    }
}

// ========== Guest Management ==========

/// Approve a guest to join the room (requires HostCap)
public fun approve_guest(
    host_cap: &HostCap,
    room: &mut MeetingRoom,
    guest: address,
    clock: &Clock,
    ctx: &mut tx_context::TxContext,
) {
    assert!(host_cap.room_id == object::uid_to_inner(&room.id), ERROR_INVALID_CAPABILITY);
    assert!(room.status != STATUS_ENDED, ERROR_ROOM_ENDED);

    // Check guest is not already in participants
    assert!(!vector::contains(&room.participants, &guest), ERROR_ALREADY_APPROVED);

    // Enforce max participants limit
    assert!(vector::length(&room.participants) + 1 <= room.max_participants, ERROR_ROOM_FULL);

    // Add guest to seal whitelist
    seal_approve_whitelist::add_to_whitelist(&mut room.seal_policy, guest, clock);

    // Add to participants
    vector::push_back(&mut room.participants, guest);

    event::emit(GuestApproved {
        room_id: object::uid_to_inner(&room.id),
        guest,
        approved_by: tx_context::sender(ctx),
    });
}

/// Revoke guest access from the room (requires HostCap)
public fun revoke_guest(
    host_cap: &HostCap,
    room: &mut MeetingRoom,
    guest: address,
    clock: &Clock,
    ctx: &mut tx_context::TxContext,
) {
    assert!(host_cap.room_id == object::uid_to_inner(&room.id), ERROR_INVALID_CAPABILITY);
    assert!(room.status != STATUS_ENDED, ERROR_ROOM_ENDED);

    // Cannot revoke a host as guest
    assert!(!vector::contains(&room.hosts, &guest), ERROR_CANNOT_REVOKE_HOST);

    // Check guest is in participants
    let (found, idx) = vector::index_of(&room.participants, &guest);
    assert!(found, ERROR_NOT_APPROVED);

    // Remove guest from seal whitelist
    seal_approve_whitelist::remove_from_whitelist(&mut room.seal_policy, guest, clock);

    // Remove from participants
    vector::remove(&mut room.participants, idx);

    event::emit(GuestRevoked {
        room_id: object::uid_to_inner(&room.id),
        guest,
        revoked_by: tx_context::sender(ctx),
    });
}

// ========== Recording Blob ID Management ==========

/// Get recording blob ID from metadata
public fun get_recording_blob_id(room: &MeetingRoom): Option<u256> {
    if (df::exists_(&room.id, b"metadata")) {
        let metadata = df::borrow<vector<u8>, MeetingMetadata>(&room.id, b"metadata");
        metadata.recording_blob_id
    } else {
        option::none<u256>()
    }
}

// ========== View Functions ==========

public fun get_room_info(room: &MeetingRoom): (String, Option<String>, vector<address>, u8) {
    (room.title, room.description, room.hosts, room.status)
}

public fun get_seal_policy_id(room: &MeetingRoom): object::ID {
    room.seal_policy_id
}

public fun is_host(room: &MeetingRoom, addr: address): bool {
    vector::contains(&room.hosts, &addr)
}

