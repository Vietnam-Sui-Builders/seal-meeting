// Improved version with indexing support and complete features
module suimeet::meeting_room;

use sui::clock::{Self, Clock};
use sui::event;
use sui::table::{Self, Table};
use suimeet::seal_approve_whitelist::{Self, SealApproveWhitelist};

// ========== Structs ==========

public struct MeetingRoom has key, store {
    id: object::UID,
    title: vector<u8>,
    hosts: vector<address>,            // All hosts (creator + added hosts)
    participants: vector<address>,     // Active participants
    max_participants: u64,
    require_approval: bool,
    seal_policy: SealApproveWhitelist,
    seal_policy_id: object::ID,       // ID of seal policy used as meeting code
    status: u8,                        // 0: scheduled, 1: active, 2: ended
    created_at: u64,
    started_at: u64,
    ended_at: u64,
}

// Enhanced registry for better room discovery
public struct RoomRegistry has key {
    id: object::UID,
    room_count: u64,
    // All room IDs for iteration
    all_rooms: vector<object::ID>,
    // Rooms by host - maps host address to list of room IDs they created
    rooms_by_host: Table<address, vector<object::ID>>,
    // Rooms by status - maps status to list of room IDs
    active_rooms: vector<object::ID>,      // STATUS_ACTIVE rooms only
    scheduled_rooms: vector<object::ID>,   // STATUS_SCHEDULED rooms only
    // Rooms by seal policy ID (used as meeting code) for quick lookup
    rooms_by_seal_id: Table<object::ID, object::ID>,
}


// ========== Events (Critical for Indexing) ==========

public struct RoomCreated has copy, drop {
    room_id: object::ID,
    host: address,
    title: vector<u8>,
    created_at: u64,
    require_approval: bool,
}

public struct RoomStarted has copy, drop {
    room_id: object::ID,
    started_at: u64,
}

public struct RoomEnded has copy, drop {
    room_id: object::ID,
    ended_at: u64,
}

public struct GuestApproved has copy, drop {
    room_id: object::ID,
    guest: address,
    approved_by: address,
    approved_at: u64,
}

public struct GuestRevoked has copy, drop {
    room_id: object::ID,
    guest: address,
    revoked_by: address,
    revoked_at: u64,
}

public struct HostAdded has copy, drop {
    room_id: object::ID,
    new_host: address,
    added_by: address,
    added_at: u64,
}

// ========== Error Codes ==========

const ERROR_NOT_HOST: u64 = 1;
const ERROR_ROOM_FULL: u64 = 2;
const ERROR_ROOM_ENDED: u64 = 3;
const ERROR_APPROVAL_REQUIRED: u64 = 4;
const ERROR_ALREADY_HOST: u64 = 5;

// Status constants
const STATUS_SCHEDULED: u8 = 1;
const STATUS_ACTIVE: u8 = 2;
const STATUS_ENDED: u8 = 3;

// ========== Init ==========

fun init(ctx: &mut tx_context::TxContext) {
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
}

// ========== Public Entry Functions ==========

public fun create_room(
    registry: &mut RoomRegistry,
    title: vector<u8>,
    max_participants: u64,
    require_approval: bool,
    clock: &Clock,
    ctx: &mut tx_context::TxContext,
) {
    let sender = tx_context::sender(ctx);

    let mut initial_participants = vector::empty<address>();
    vector::push_back(&mut initial_participants, sender);

    // Create seal policy - its ID will be used as the meeting code
    let policy = seal_approve_whitelist::create(initial_participants, ctx);
    let seal_policy_id = policy.policy_id();

    let room_uid = object::new(ctx);
    let room_id = object::uid_to_inner(&room_uid);
    let created_at = clock::timestamp_ms(clock);

    let mut hosts = vector::empty<address>();
    vector::push_back(&mut hosts, sender);

    let room = MeetingRoom {
        id: room_uid,
        title,
        hosts,
        participants: initial_participants,
        max_participants,
        require_approval,
        seal_policy: policy,
        seal_policy_id,
        status: STATUS_SCHEDULED,
        created_at,
        started_at: 0,
        ended_at: 0,
    };

    // Update registry with room tracking
    vector::push_back(&mut registry.all_rooms, room_id);
    vector::push_back(&mut registry.scheduled_rooms, room_id);
    table::add(&mut registry.rooms_by_seal_id, seal_policy_id, room_id);

    // Track rooms by host
    if (table::contains(&registry.rooms_by_host, sender)) {
        let host_rooms = table::borrow_mut(&mut registry.rooms_by_host, sender);
        vector::push_back(host_rooms, room_id);
    } else {
        let mut host_rooms = vector::empty<object::ID>();
        vector::push_back(&mut host_rooms, room_id);
        table::add(&mut registry.rooms_by_host, sender, host_rooms);
    };

    // Emit event for indexing
    event::emit(RoomCreated {
        room_id,
        host: sender,
        title,
        created_at,
        require_approval,
    });

    registry.room_count = registry.room_count + 1;
    transfer::share_object(room);
}

public fun start_room(
    registry: &mut RoomRegistry,
    room: &mut MeetingRoom,
    clock: &Clock,
    ctx: &mut tx_context::TxContext,
) {
    let sender = tx_context::sender(ctx);
    assert!(vector::contains(&room.hosts, &sender), ERROR_NOT_HOST);
    assert!(room.status == STATUS_SCHEDULED, ERROR_ROOM_ENDED);

    let room_id = object::uid_to_inner(&room.id);
    let started_at = clock::timestamp_ms(clock);
    room.status = STATUS_ACTIVE;
    room.started_at = started_at;

    // Update registry: move from scheduled to active
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

public fun end_room(
    registry: &mut RoomRegistry,
    room: &mut MeetingRoom,
    clock: &Clock,
    ctx: &mut tx_context::TxContext,
) {
    let sender = tx_context::sender(ctx);
    assert!(vector::contains(&room.hosts, &sender), ERROR_NOT_HOST);
    assert!(room.status != STATUS_ENDED, ERROR_ROOM_ENDED);

    let room_id = object::uid_to_inner(&room.id);
    let ended_at = clock::timestamp_ms(clock);
    room.status = STATUS_ENDED;
    room.ended_at = ended_at;

    // Update registry: remove from active rooms
    let (found, idx) = vector::index_of(&registry.active_rooms, &room_id);
    if (found) {
        vector::remove(&mut registry.active_rooms, idx);
    };

    event::emit(RoomEnded {
        room_id,
        ended_at,
    });
}


public fun approve_guest(
    room: &mut MeetingRoom,
    guest: address,
    clock: &Clock,
    ctx: &mut tx_context::TxContext,
) {
    let sender = tx_context::sender(ctx);
    assert!(room.require_approval, ERROR_APPROVAL_REQUIRED);
    assert!(vector::contains(&room.hosts, &sender), ERROR_NOT_HOST);
    assert!(vector::length(&room.participants) <= room.max_participants, ERROR_ROOM_FULL);

    seal_approve_whitelist::add_to_whitelist(&mut room.seal_policy, guest, clock);
    vector::push_back(&mut room.participants, guest);

    event::emit(GuestApproved {
        room_id: object::uid_to_inner(&room.id),
        guest,
        approved_by: sender,
        approved_at: clock::timestamp_ms(clock),
    });
}

public fun revoke_guest(
    room: &mut MeetingRoom,
    guest: address,
    clock: &Clock,
    ctx: &mut tx_context::TxContext,
) {
    let sender = tx_context::sender(ctx);
    assert!(vector::contains(&room.hosts, &sender), ERROR_NOT_HOST);

    seal_approve_whitelist::remove_from_whitelist(&mut room.seal_policy, guest, clock);

    // Also remove from participants if they're in the room
    let (exists, idx) = vector::index_of(&room.participants, &guest);
    if (exists) {
        vector::remove(&mut room.participants, idx);
    };

    event::emit(GuestRevoked {
        room_id: object::uid_to_inner(&room.id),
        guest,
        revoked_by: sender,
        revoked_at: clock::timestamp_ms(clock),
    });
}

public fun add_host(
    room: &mut MeetingRoom,
    new_host: address,
    clock: &Clock,
    ctx: &mut tx_context::TxContext,
) {
    let sender = tx_context::sender(ctx);
    // Only the first host (creator) can add new hosts
    assert!(vector::borrow(&room.hosts, 0) == &sender, ERROR_NOT_HOST);
    assert!(!vector::contains(&room.hosts, &new_host), ERROR_ALREADY_HOST); // Already a host

    vector::push_back(&mut room.hosts, new_host);
    seal_approve_whitelist::add_to_whitelist(&mut room.seal_policy, new_host, clock);
    vector::push_back(&mut room.participants, new_host);
    event::emit(HostAdded {
        room_id: object::uid_to_inner(&room.id),
        added_by: sender,
        new_host,
        added_at: clock::timestamp_ms(clock),
    });
}

// ========== View Functions (for frontend/indexer) ==========

// Room view functions
public fun get_room_info(room: &MeetingRoom): (vector<u8>, vector<address>, u8, u64, u64, u64) {
    (room.title, room.hosts, room.status, room.created_at, room.started_at, room.ended_at)
}

public fun get_participants(room: &MeetingRoom): vector<address> {
    room.participants
}

public fun get_participant_count(room: &MeetingRoom): u64 {
    vector::length(&room.participants)
}

public fun is_host(room: &MeetingRoom, addr: address): bool {
    vector::contains(&room.hosts, &addr)
}

public fun get_hosts(room: &MeetingRoom): vector<address> {
    room.hosts
}

public fun get_status(room: &MeetingRoom): u8 {
    room.status
}

public fun get_seal_policy_id(room: &MeetingRoom): object::ID {
    room.seal_policy_id
}

// Registry discovery view functions
public fun get_total_room_count(registry: &RoomRegistry): u64 {
    registry.room_count
}

public fun get_all_room_ids(registry: &RoomRegistry): vector<object::ID> {
    registry.all_rooms
}

public fun get_active_room_ids(registry: &RoomRegistry): vector<object::ID> {
    registry.active_rooms
}

public fun get_scheduled_room_ids(registry: &RoomRegistry): vector<object::ID> {
    registry.scheduled_rooms
}

public fun get_active_room_count(registry: &RoomRegistry): u64 {
    vector::length(&registry.active_rooms)
}

public fun get_scheduled_room_count(registry: &RoomRegistry): u64 {
    vector::length(&registry.scheduled_rooms)
}

public fun get_rooms_by_host(registry: &RoomRegistry, host: address): vector<object::ID> {
    if (table::contains(&registry.rooms_by_host, host)) {
        *table::borrow(&registry.rooms_by_host, host)
    } else {
        vector::empty<object::ID>()
    }
}

public fun get_room_id_by_seal_id(registry: &RoomRegistry, seal_id: object::ID): object::ID {
    assert!(table::contains(&registry.rooms_by_seal_id, seal_id), 404); // Room not found
    *table::borrow(&registry.rooms_by_seal_id, seal_id)
}

public fun has_room_with_seal_id(registry: &RoomRegistry, seal_id: object::ID): bool {
    table::contains(&registry.rooms_by_seal_id, seal_id)
}

public fun get_host_room_count(registry: &RoomRegistry, host: address): u64 {
    if (table::contains(&registry.rooms_by_host, host)) {
        let rooms = table::borrow(&registry.rooms_by_host, host);
        vector::length(rooms)
    } else {
        0
    }
}
