module suimeet::meeting_room;

use sui::clock::{Self, Clock};
use sui::object::{Self, UID};
use sui::transfer;
use sui::tx_context::{Self, TxContext};
use suimeet::seal_approve_whitelist::{Self, SealApproveWhitelist};

public struct MeetingRoom has key, store {
    id: UID,
    title: vector<u8>,
    participants: vector<address>,
    require_approval: bool,
    seal_policy: SealApproveWhitelist,
}

public entry fun create_room(
    title: vector<u8>,
    initial_participants: vector<address>,
    require_approval: bool,
    ctx: &mut TxContext,
) {
    let policy = seal_approve_whitelist::create(initial_participants, ctx);
    let room = MeetingRoom {
        id: object::new(ctx),
        title,
        participants: initial_participants,
        require_approval,
        seal_policy: policy,
    };
    transfer::share_object(room);
}

public entry fun approve_guest(
    room: &mut MeetingRoom,
    guest: address,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(room.require_approval, 0);
    assert!(vector::contains(&room.participants, &tx_context::sender(ctx)), 1); // Host only
    seal_approve_whitelist::add_to_whitelist(&mut room.seal_policy, guest, clock);
}

public entry fun revoke_guest(
    room: &mut MeetingRoom,
    guest: address,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(vector::contains(&room.participants, &tx_context::sender(ctx)), 1); // Host only
    seal_approve_whitelist::remove_from_whitelist(&mut room.seal_policy, guest, clock);
}
