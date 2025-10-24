module suimeet::seal_approve_whitelist;

use std::vector;
use sui::clock::{Self, Clock};
use sui::object::{Self, UID};
use sui::tx_context::{Self, TxContext};
use sui::bcs::{Self, BCS};


/// Struct for whitelist policy
public struct SealApproveWhitelist has key, store {
    id: UID,
    whitelist: vector<address>,
    updated_at: u64, // Timestamp for last update
}

/// Create a new whitelist policy
public fun create(initial_whitelist: vector<address>, ctx: &mut TxContext): SealApproveWhitelist {
    SealApproveWhitelist {
        id: object::new(ctx),
        whitelist: initial_whitelist,
        updated_at: tx_context::epoch(ctx),
    }
}

/// Add to whitelist (host-only, with Clock)
public entry fun add_to_whitelist(
    policy: &mut SealApproveWhitelist,
    guest: address,
    clock: &Clock,
) {
    assert!(!vector::contains(&policy.whitelist, &guest), 1); // No duplicates
    vector::push_back(&mut policy.whitelist, guest);
    policy.updated_at = clock::timestamp_ms(clock);
}

/// Remove from whitelist (host-only, with Clock)
public entry fun remove_from_whitelist(
    policy: &mut SealApproveWhitelist,
    guest: address,
    clock: &Clock,
) {
    let mut i = 0;
    let len = vector::length(&policy.whitelist);
    while (i < len) {
        if (*vector::borrow(&policy.whitelist, i) == guest) {
            vector::remove(&mut policy.whitelist, i);
            break
        };
        i = i + 1;
    };
    policy.updated_at = clock::timestamp_ms(clock);
}

/// Seal approve function for decryption checks
public entry fun seal_approve(id: vector<u8>, policy: &SealApproveWhitelist, _clock: &Clock): bool {
    let mut bte = bcs::new(id);
    let guest_addr = bte.peel_address();

    vector::contains(&policy.whitelist, &guest_addr)
}
