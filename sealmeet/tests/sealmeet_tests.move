// Comprehensive unit tests for sealmeet module
#[test_only]
module sealmeet::sealmeet_tests;

use sui::test_scenario::{Self as ts, Scenario};
use sui::clock::{Self, Clock};
use std::string;
use sealmeet::sealmeet::{
    Self,
    MeetingRoom,
    RoomRegistry,
    HostCap,
};

// Test addresses
const ADMIN: address = @0xAD;
const HOST: address = @0xA1;
const GUEST1: address = @0xB1;
const GUEST2: address = @0xB2;

// Error codes (must match sealmeet.move)
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

// Status codes
const STATUS_SCHEDULED: u8 = 1;
const STATUS_ACTIVE: u8 = 2;
const STATUS_ENDED: u8 = 3;

// Helper function to create a test clock
fun create_test_clock(scenario: &mut Scenario): Clock {
    clock::create_for_testing(ts::ctx(scenario))
}

// Helper function to advance clock
fun advance_clock(clock: &mut Clock, ms: u64) {
    clock::increment_for_testing(clock, ms);
}

// ========== Test: Room Creation ==========

#[test]
fun test_create_room_basic() {
    let mut scenario = ts::begin(HOST);
    let mut clock = create_test_clock(&mut scenario);

    // Create registry
    ts::next_tx(&mut scenario, ADMIN);
    {
        sealmeet::test_init(ts::ctx(&mut scenario));
    };

    // Create room
    ts::next_tx(&mut scenario, HOST);
    {
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);

        sealmeet::create_room(
            &mut registry,
            b"Test Meeting",
            option::some(b"This is a test meeting"),
            10,
            false,
            vector[HOST],
            &clock,
            ts::ctx(&mut scenario)
        );

        assert!(sealmeet::room_count(&registry) == 1, 0);
        ts::return_shared(registry);
    };

    // Verify HostCap was created
    ts::next_tx(&mut scenario, HOST);
    {
        assert!(ts::has_most_recent_for_sender<HostCap>(&scenario), 1);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
fun test_create_room_with_initial_participants() {
    let mut scenario = ts::begin(HOST);
    let mut clock = create_test_clock(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    {
        sealmeet::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);

        sealmeet::create_room(
            &mut registry,
            b"Team Meeting",
            option::none(),
            10,
            true,
            vector[HOST, GUEST1, GUEST2],
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_shared(registry);
    };

    // Verify room was created with participants
    ts::next_tx(&mut scenario, HOST);
    {
        let room = ts::take_shared<MeetingRoom>(&scenario);
        let (title, desc, hosts, status) = sealmeet::get_room_info(&room);

        assert!(string::as_bytes(&title) == &b"Team Meeting", 0);
        assert!(option::is_none(&desc), 1);
        assert!(vector::length(&hosts) == 1, 2);
        assert!(status == STATUS_SCHEDULED, 3);

        ts::return_shared(room);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
fun test_create_room_removes_duplicate_participants() {
    let mut scenario = ts::begin(HOST);
    let mut clock = create_test_clock(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    {
        sealmeet::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);

        // Include duplicates in initial_participants
        sealmeet::create_room(
            &mut registry,
            b"Test Room",
            option::none(),
            10,
            false,
            vector[HOST, GUEST1, GUEST1, GUEST2, HOST],
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_shared(registry);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = ERROR_TOO_MANY_PARTICIPANTS, location = sealmeet)]
fun test_create_room_exceeds_max_participants() {
    let mut scenario = ts::begin(HOST);
    let mut clock = create_test_clock(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    {
        sealmeet::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);

        // Try to create room with max > 20
        sealmeet::create_room(
            &mut registry,
            b"Too Large",
            option::none(),
            25,
            false,
            vector[HOST],
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_shared(registry);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = ERROR_INVALID_NUMBER, location = sealmeet)]
fun test_create_room_zero_max_participants() {
    let mut scenario = ts::begin(HOST);
    let mut clock = create_test_clock(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    {
        sealmeet::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);

        sealmeet::create_room(
            &mut registry,
            b"Zero Max",
            option::none(),
            0,
            false,
            vector[HOST],
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_shared(registry);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

// ========== Test: Room Lifecycle ==========

#[test]
fun test_start_room() {
    let mut scenario = ts::begin(HOST);
    let mut clock = create_test_clock(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    {
        sealmeet::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);

        sealmeet::create_room(
            &mut registry,
            b"Meeting",
            option::none(),
            10,
            false,
            vector[HOST],
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_shared(registry);
    };

    // Start the room
    ts::next_tx(&mut scenario, HOST);
    {
        let host_cap = ts::take_from_sender<HostCap>(&scenario);
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);
        let mut room = ts::take_shared<MeetingRoom>(&scenario);

        advance_clock(&mut clock, 1000);
        sealmeet::start_room(&host_cap, &mut registry, &mut room, &clock);

        let (_, _, _, status) = sealmeet::get_room_info(&room);
        assert!(status == STATUS_ACTIVE, 0);

        ts::return_to_sender(&scenario, host_cap);
        ts::return_shared(registry);
        ts::return_shared(room);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = ERROR_ROOM_ALREADY_ACTIVE, location = sealmeet)]
fun test_start_room_already_active() {
    let mut scenario = ts::begin(HOST);
    let mut clock = create_test_clock(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    {
        sealmeet::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);

        sealmeet::create_room(
            &mut registry,
            b"Meeting",
            option::none(),
            10,
            false,
            vector[HOST],
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_shared(registry);
    };

    // Start room first time
    ts::next_tx(&mut scenario, HOST);
    {
        let host_cap = ts::take_from_sender<HostCap>(&scenario);
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);
        let mut room = ts::take_shared<MeetingRoom>(&scenario);

        sealmeet::start_room(&host_cap, &mut registry, &mut room, &clock);

        ts::return_to_sender(&scenario, host_cap);
        ts::return_shared(registry);
        ts::return_shared(room);
    };

    // Try to start again - should fail
    ts::next_tx(&mut scenario, HOST);
    {
        let host_cap = ts::take_from_sender<HostCap>(&scenario);
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);
        let mut room = ts::take_shared<MeetingRoom>(&scenario);

        sealmeet::start_room(&host_cap, &mut registry, &mut room, &clock);

        ts::return_to_sender(&scenario, host_cap);
        ts::return_shared(registry);
        ts::return_shared(room);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
fun test_end_room() {
    let mut scenario = ts::begin(HOST);
    let mut clock = create_test_clock(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    {
        sealmeet::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);

        sealmeet::create_room(
            &mut registry,
            b"Meeting",
            option::none(),
            10,
            false,
            vector[HOST],
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_shared(registry);
    };

    // Start room
    ts::next_tx(&mut scenario, HOST);
    {
        let host_cap = ts::take_from_sender<HostCap>(&scenario);
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);
        let mut room = ts::take_shared<MeetingRoom>(&scenario);

        sealmeet::start_room(&host_cap, &mut registry, &mut room, &clock);

        ts::return_to_sender(&scenario, host_cap);
        ts::return_shared(registry);
        ts::return_shared(room);
    };

    // End room
    ts::next_tx(&mut scenario, HOST);
    {
        let host_cap = ts::take_from_sender<HostCap>(&scenario);
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);
        let mut room = ts::take_shared<MeetingRoom>(&scenario);

        advance_clock(&mut clock, 5000);
        sealmeet::end_room(&host_cap, &mut registry, &mut room, &clock);

        let (_, _, _, status) = sealmeet::get_room_info(&room);
        assert!(status == STATUS_ENDED, 0);

        ts::return_to_sender(&scenario, host_cap);
        ts::return_shared(registry);
        ts::return_shared(room);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = ERROR_ROOM_ENDED, location = sealmeet)]
fun test_end_room_already_ended() {
    let mut scenario = ts::begin(HOST);
    let mut clock = create_test_clock(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    {
        sealmeet::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);

        sealmeet::create_room(
            &mut registry,
            b"Meeting",
            option::none(),
            10,
            false,
            vector[HOST],
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_shared(registry);
    };

    // End room first time
    ts::next_tx(&mut scenario, HOST);
    {
        let host_cap = ts::take_from_sender<HostCap>(&scenario);
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);
        let mut room = ts::take_shared<MeetingRoom>(&scenario);

        sealmeet::end_room(&host_cap, &mut registry, &mut room, &clock);

        ts::return_to_sender(&scenario, host_cap);
        ts::return_shared(registry);
        ts::return_shared(room);
    };

    // Try to end again - should fail
    ts::next_tx(&mut scenario, HOST);
    {
        let host_cap = ts::take_from_sender<HostCap>(&scenario);
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);
        let mut room = ts::take_shared<MeetingRoom>(&scenario);

        sealmeet::end_room(&host_cap, &mut registry, &mut room, &clock);

        ts::return_to_sender(&scenario, host_cap);
        ts::return_shared(registry);
        ts::return_shared(room);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

// ========== Test: Host Management ==========

#[test]
fun test_add_new_host() {
    let mut scenario = ts::begin(HOST);
    let mut clock = create_test_clock(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    {
        sealmeet::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);

        sealmeet::create_room(
            &mut registry,
            b"Meeting",
            option::none(),
            10,
            false,
            vector[HOST],
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_shared(registry);
    };

    // Add new host
    ts::next_tx(&mut scenario, HOST);
    {
        let host_cap = ts::take_from_sender<HostCap>(&scenario);
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);
        let mut room = ts::take_shared<MeetingRoom>(&scenario);

        sealmeet::add_new_host(
            &host_cap,
            &mut registry,
            &mut room,
            GUEST1,
            &clock,
            ts::ctx(&mut scenario)
        );

        assert!(sealmeet::is_host(&room, GUEST1), 0);

        ts::return_to_sender(&scenario, host_cap);
        ts::return_shared(registry);
        ts::return_shared(room);
    };

    // Verify GUEST1 received HostCap
    ts::next_tx(&mut scenario, GUEST1);
    {
        assert!(ts::has_most_recent_for_sender<HostCap>(&scenario), 1);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = ERROR_ALREADY_HOST, location = sealmeet)]
fun test_add_new_host_already_host() {
    let mut scenario = ts::begin(HOST);
    let mut clock = create_test_clock(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    {
        sealmeet::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);

        sealmeet::create_room(
            &mut registry,
            b"Meeting",
            option::none(),
            10,
            false,
            vector[HOST],
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_shared(registry);
    };

    // Try to add HOST as host again
    ts::next_tx(&mut scenario, HOST);
    {
        let host_cap = ts::take_from_sender<HostCap>(&scenario);
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);
        let mut room = ts::take_shared<MeetingRoom>(&scenario);

        sealmeet::add_new_host(
            &host_cap,
            &mut registry,
            &mut room,
            HOST,
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_to_sender(&scenario, host_cap);
        ts::return_shared(registry);
        ts::return_shared(room);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = ERROR_ROOM_ENDED, location = sealmeet)]
fun test_add_new_host_room_ended() {
    let mut scenario = ts::begin(HOST);
    let mut clock = create_test_clock(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    {
        sealmeet::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);

        sealmeet::create_room(
            &mut registry,
            b"Meeting",
            option::none(),
            10,
            false,
            vector[HOST],
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_shared(registry);
    };

    // End room
    ts::next_tx(&mut scenario, HOST);
    {
        let host_cap = ts::take_from_sender<HostCap>(&scenario);
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);
        let mut room = ts::take_shared<MeetingRoom>(&scenario);

        sealmeet::end_room(&host_cap, &mut registry, &mut room, &clock);

        ts::return_to_sender(&scenario, host_cap);
        ts::return_shared(registry);
        ts::return_shared(room);
    };

    // Try to add host after room ended
    ts::next_tx(&mut scenario, HOST);
    {
        let host_cap = ts::take_from_sender<HostCap>(&scenario);
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);
        let mut room = ts::take_shared<MeetingRoom>(&scenario);

        sealmeet::add_new_host(
            &host_cap,
            &mut registry,
            &mut room,
            GUEST1,
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_to_sender(&scenario, host_cap);
        ts::return_shared(registry);
        ts::return_shared(room);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

// ========== Test: Guest Management ==========

#[test]
fun test_approve_guest() {
    let mut scenario = ts::begin(HOST);
    let mut clock = create_test_clock(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    {
        sealmeet::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);

        sealmeet::create_room(
            &mut registry,
            b"Meeting",
            option::none(),
            10,
            true,
            vector[HOST],
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_shared(registry);
    };

    // Approve guest
    ts::next_tx(&mut scenario, HOST);
    {
        let host_cap = ts::take_from_sender<HostCap>(&scenario);
        let mut room = ts::take_shared<MeetingRoom>(&scenario);

        sealmeet::approve_guest(
            &host_cap,
            &mut room,
            GUEST1,
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_to_sender(&scenario, host_cap);
        ts::return_shared(room);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = ERROR_ALREADY_APPROVED, location = sealmeet)]
fun test_approve_guest_already_approved() {
    let mut scenario = ts::begin(HOST);
    let mut clock = create_test_clock(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    {
        sealmeet::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);

        sealmeet::create_room(
            &mut registry,
            b"Meeting",
            option::none(),
            10,
            true,
            vector[HOST, GUEST1],
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_shared(registry);
    };

    // Try to approve already approved guest
    ts::next_tx(&mut scenario, HOST);
    {
        let host_cap = ts::take_from_sender<HostCap>(&scenario);
        let mut room = ts::take_shared<MeetingRoom>(&scenario);

        sealmeet::approve_guest(
            &host_cap,
            &mut room,
            GUEST1,
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_to_sender(&scenario, host_cap);
        ts::return_shared(room);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = ERROR_ROOM_FULL, location = sealmeet)]
fun test_approve_guest_room_full() {
    let mut scenario = ts::begin(HOST);
    let mut clock = create_test_clock(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    {
        sealmeet::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);

        // Create room with max 2 participants
        sealmeet::create_room(
            &mut registry,
            b"Small Meeting",
            option::none(),
            2,
            true,
            vector[HOST, GUEST1],
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_shared(registry);
    };

    // Try to approve third guest - should fail
    ts::next_tx(&mut scenario, HOST);
    {
        let host_cap = ts::take_from_sender<HostCap>(&scenario);
        let mut room = ts::take_shared<MeetingRoom>(&scenario);

        sealmeet::approve_guest(
            &host_cap,
            &mut room,
            GUEST2,
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_to_sender(&scenario, host_cap);
        ts::return_shared(room);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
fun test_revoke_guest() {
    let mut scenario = ts::begin(HOST);
    let mut clock = create_test_clock(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    {
        sealmeet::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);

        sealmeet::create_room(
            &mut registry,
            b"Meeting",
            option::none(),
            10,
            true,
            vector[HOST, GUEST1],
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_shared(registry);
    };

    // Revoke guest
    ts::next_tx(&mut scenario, HOST);
    {
        let host_cap = ts::take_from_sender<HostCap>(&scenario);
        let mut room = ts::take_shared<MeetingRoom>(&scenario);

        sealmeet::revoke_guest(
            &host_cap,
            &mut room,
            GUEST1,
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_to_sender(&scenario, host_cap);
        ts::return_shared(room);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = ERROR_NOT_APPROVED, location = sealmeet)]
fun test_revoke_guest_not_approved() {
    let mut scenario = ts::begin(HOST);
    let mut clock = create_test_clock(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    {
        sealmeet::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);

        sealmeet::create_room(
            &mut registry,
            b"Meeting",
            option::none(),
            10,
            true,
            vector[HOST],
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_shared(registry);
    };

    // Try to revoke guest who was never approved
    ts::next_tx(&mut scenario, HOST);
    {
        let host_cap = ts::take_from_sender<HostCap>(&scenario);
        let mut room = ts::take_shared<MeetingRoom>(&scenario);

        sealmeet::revoke_guest(
            &host_cap,
            &mut room,
            GUEST1,
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_to_sender(&scenario, host_cap);
        ts::return_shared(room);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = ERROR_CANNOT_REVOKE_HOST, location = sealmeet)]
fun test_revoke_guest_cannot_revoke_host() {
    let mut scenario = ts::begin(HOST);
    let mut clock = create_test_clock(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    {
        sealmeet::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);

        sealmeet::create_room(
            &mut registry,
            b"Meeting",
            option::none(),
            10,
            false,
            vector[HOST],
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_shared(registry);
    };

    // Add GUEST1 as host
    ts::next_tx(&mut scenario, HOST);
    {
        let host_cap = ts::take_from_sender<HostCap>(&scenario);
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);
        let mut room = ts::take_shared<MeetingRoom>(&scenario);

        sealmeet::add_new_host(
            &host_cap,
            &mut registry,
            &mut room,
            GUEST1,
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_to_sender(&scenario, host_cap);
        ts::return_shared(registry);
        ts::return_shared(room);
    };

    // Try to revoke GUEST1 who is now a host - should fail
    ts::next_tx(&mut scenario, HOST);
    {
        let host_cap = ts::take_from_sender<HostCap>(&scenario);
        let mut room = ts::take_shared<MeetingRoom>(&scenario);

        sealmeet::revoke_guest(
            &host_cap,
            &mut room,
            GUEST1,
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_to_sender(&scenario, host_cap);
        ts::return_shared(room);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

// ========== Test: Metadata ==========

#[test]
fun test_add_metadata() {
    let mut scenario = ts::begin(HOST);
    let mut clock = create_test_clock(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    {
        sealmeet::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);

        sealmeet::create_room(
            &mut registry,
            b"Meeting",
            option::none(),
            10,
            false,
            vector[HOST],
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_shared(registry);
    };

    // Add metadata
    ts::next_tx(&mut scenario, HOST);
    {
        let host_cap = ts::take_from_sender<HostCap>(&scenario);
        let mut room = ts::take_shared<MeetingRoom>(&scenario);

        sealmeet::add_metadata(
            &host_cap,
            &mut room,
            b"en-US",
            b"UTC",
            option::none(),
            ts::ctx(&mut scenario)
        );

        // Verify metadata was added
        let metadata_opt = sealmeet::get_metadata(&room);
        assert!(option::is_some(&metadata_opt), 0);

        ts::return_to_sender(&scenario, host_cap);
        ts::return_shared(room);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
fun test_update_metadata() {
    let mut scenario = ts::begin(HOST);
    let mut clock = create_test_clock(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    {
        sealmeet::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);

        sealmeet::create_room(
            &mut registry,
            b"Meeting",
            option::none(),
            10,
            false,
            vector[HOST],
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_shared(registry);
    };

    // Add initial metadata
    ts::next_tx(&mut scenario, HOST);
    {
        let host_cap = ts::take_from_sender<HostCap>(&scenario);
        let mut room = ts::take_shared<MeetingRoom>(&scenario);

        sealmeet::add_metadata(
            &host_cap,
            &mut room,
            b"en-US",
            b"UTC",
            option::none(),
            ts::ctx(&mut scenario)
        );

        ts::return_to_sender(&scenario, host_cap);
        ts::return_shared(room);
    };

    // Update metadata
    ts::next_tx(&mut scenario, HOST);
    {
        let host_cap = ts::take_from_sender<HostCap>(&scenario);
        let mut room = ts::take_shared<MeetingRoom>(&scenario);

        sealmeet::add_metadata(
            &host_cap,
            &mut room,
            b"fr-FR",
            b"CET",
            option::some(12345u256),
            ts::ctx(&mut scenario)
        );

        // Verify metadata was updated
        let blob_id_opt = sealmeet::get_recording_blob_id(&room);
        assert!(option::is_some(&blob_id_opt), 0);

        ts::return_to_sender(&scenario, host_cap);
        ts::return_shared(room);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
fun test_get_metadata_no_metadata() {
    let mut scenario = ts::begin(HOST);
    let mut clock = create_test_clock(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    {
        sealmeet::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);

        sealmeet::create_room(
            &mut registry,
            b"Meeting",
            option::none(),
            10,
            false,
            vector[HOST],
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_shared(registry);
    };

    // Check metadata before adding any
    ts::next_tx(&mut scenario, HOST);
    {
        let room = ts::take_shared<MeetingRoom>(&scenario);

        let metadata_opt = sealmeet::get_metadata(&room);
        assert!(option::is_none(&metadata_opt), 0);

        let blob_id_opt = sealmeet::get_recording_blob_id(&room);
        assert!(option::is_none(&blob_id_opt), 1);

        ts::return_shared(room);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

// ========== Test: View Functions ==========

#[test]
fun test_get_room_info() {
    let mut scenario = ts::begin(HOST);
    let mut clock = create_test_clock(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    {
        sealmeet::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);

        sealmeet::create_room(
            &mut registry,
            b"Test Room",
            option::some(b"Test Description"),
            10,
            false,
            vector[HOST],
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_shared(registry);
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let room = ts::take_shared<MeetingRoom>(&scenario);

        let (title, desc, hosts, status) = sealmeet::get_room_info(&room);

        assert!(string::as_bytes(&title) == &b"Test Room", 0);
        assert!(option::is_some(&desc), 1);
        assert!(vector::length(&hosts) == 1, 2);
        assert!(status == STATUS_SCHEDULED, 3);

        ts::return_shared(room);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
fun test_is_host() {
    let mut scenario = ts::begin(HOST);
    let mut clock = create_test_clock(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    {
        sealmeet::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);

        sealmeet::create_room(
            &mut registry,
            b"Meeting",
            option::none(),
            10,
            false,
            vector[HOST],
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_shared(registry);
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let room = ts::take_shared<MeetingRoom>(&scenario);

        assert!(sealmeet::is_host(&room, HOST), 0);
        assert!(!sealmeet::is_host(&room, GUEST1), 1);

        ts::return_shared(room);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
fun test_get_seal_policy_id() {
    let mut scenario = ts::begin(HOST);
    let mut clock = create_test_clock(&mut scenario);

    ts::next_tx(&mut scenario, ADMIN);
    {
        sealmeet::test_init(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let mut registry = ts::take_shared<RoomRegistry>(&scenario);

        sealmeet::create_room(
            &mut registry,
            b"Meeting",
            option::none(),
            10,
            false,
            vector[HOST],
            &clock,
            ts::ctx(&mut scenario)
        );

        ts::return_shared(registry);
    };

    ts::next_tx(&mut scenario, HOST);
    {
        let room = ts::take_shared<MeetingRoom>(&scenario);

        let seal_id = sealmeet::get_seal_policy_id(&room);
        // Just verify it returns without error
        let _ = seal_id;

        ts::return_shared(room);
    };

    clock::destroy_for_testing(clock);
    ts::end(scenario);
}
