# Room & Whitelist Feature Guide

## Overview

The SuiMeet room creation and access control system implements blockchain-secured meeting rooms with on-chain whitelist policies using Sui's Move contracts and Seal SDK patterns.

## Architecture

### Smart Contracts (`suimeet/sources/`)

**`suimeet.move`** - Main meeting room contract:
- `MeetingRoom` struct: Stores room title, participants, approval settings, and Seal policy
- `create_room()`: Creates a new shared meeting room object with initial whitelist
- `approve_guest()`: Adds an address to the whitelist (host only)
- `revoke_guest()`: Removes an address from the whitelist (host only)

**`seal_approve_whitelist.move`** - Whitelist policy management:
- `SealApproveWhitelist` struct: Stores allowed addresses and last update timestamp
- `add_to_whitelist()`: Adds address with timestamp (requires Clock object)
- `remove_from_whitelist()`: Removes address with timestamp
- `seal_approve()`: Checks if an address is whitelisted (for decryption verification)

### Frontend Pages

**`/room`** - Create Meeting Screen (Host):
- Two-column layout: Meeting details form + Whitelist management
- Real-time Sui address validation
- Creates on-chain `MeetingRoom` object with initial whitelist
- Transitions to manage mode after successful creation

**`/room?roomId=XXX`** - Manage Room Screen (Host):
- Displays sealed invite link and room ID
- Dynamic whitelist management (approve/revoke guests)
- Real-time on-chain updates using `approve_guest` and `revoke_guest` calls
- Room information panel showing policy update timestamps

**`/room/join?roomId=XXX`** - Guest Verification Screen:
- Queries on-chain room data
- Checks guest address against whitelist
- Three states:
  - **Approved**: Guest is whitelisted → Can join meeting
  - **Waiting**: Guest not whitelisted + approval required → Show waiting room
  - **Denied**: Guest not whitelisted + no approval required → Access denied

## User Flows

### Host: Creating a Meeting Room

1. **Navigate to `/room`**
   - Empty whitelist, form ready for input

2. **Fill Meeting Details**
   - Title: "Team Sync - Q1 Planning"
   - Date/Time: 2025-01-15 @ 14:00
   - Duration: 60 minutes
   - Toggle "Require host approval" (default: ON)

3. **Build Whitelist**
   - Add Sui addresses (one at a time or paste comma-separated)
   - Validation: Must start with `0x`, hex format, 3-66 chars
   - Visual feedback: Each address shown with avatar + remove button

4. **Create & Seal Invite**
   - Click "Create & Seal Invite"
   - Wallet prompts for signature
   - Transaction calls `create_room()` with:
     ```typescript
     - title: bytes (UTF-8 encoded)
     - initial_participants: vector<address>
     - require_approval: bool
     ```
   - On success: Extract `MeetingRoom` object ID from transaction effects

5. **View Management Screen**
   - Auto-redirect to `/room?roomId={objectId}`
   - Copy room ID or invite link
   - Manage whitelist dynamically

### Host: Managing Access

**Approve New Guest**:
1. Enter guest's Sui address in "Approve New Guest" input
2. Click green checkmark
3. Transaction calls `approve_guest(room, guest_address, clock)`
4. Guest added to on-chain whitelist with timestamp

**Revoke Guest**:
1. Find guest in whitelist
2. Click "Revoke" button
3. Transaction calls `revoke_guest(room, guest_address, clock)`
4. Guest removed from whitelist immediately

### Guest: Joining a Meeting

1. **Receive Invite Link**
   - Host shares: `https://yourapp.com/room/join?roomId=0xABC...`
   - Or QR code for mobile

2. **Click Link → Verification**
   - Page loads, queries `suiClient.getObject(roomId)`
   - Fetches `seal_policy.whitelist` array

3. **Check Wallet Connection**
   - If not connected → Show "Connect Wallet" prompt
   - If connected → Proceed to whitelist check

4. **Whitelist Verification**
   ```typescript
   const whitelist = roomData.seal_policy.fields.whitelist;
   const isWhitelisted = whitelist.includes(guestAddress);
   ```

5. **Access Decision**
   - **If whitelisted**: Show green "Access Approved" screen → "Join Meeting Now" button
   - **If not whitelisted + approval required**: Show yellow "Waiting for Approval" screen
   - **If not whitelisted + no approval**: Show red "Access Denied" screen

## Technical Details

### Transaction Structure

**Create Room**:
```typescript
const txb = new Transaction();
const titleBytes = Array.from(new TextEncoder().encode(title));
const addresses = ['0x123...', '0x456...'];

txb.moveCall({
  target: `${PACKAGE_ID}::meeting_room::create_room`,
  arguments: [
    txb.pure.vector('u8', titleBytes),
    txb.pure.vector('address', addresses),
    txb.pure.bool(requireApproval),
  ],
});
```

**Approve Guest**:
```typescript
txb.moveCall({
  target: `${PACKAGE_ID}::meeting_room::approve_guest`,
  arguments: [
    txb.object(roomId),           // Shared MeetingRoom object
    txb.pure.address(guestAddr),  // New guest address
    txb.object('0x6'),            // Sui Clock object (testnet/mainnet)
  ],
});
```

**Revoke Guest**:
```typescript
txb.moveCall({
  target: `${PACKAGE_ID}::meeting_room::revoke_guest`,
  arguments: [
    txb.object(roomId),
    txb.pure.address(guestAddr),
    txb.object('0x6'),
  ],
});
```

### On-Chain Data Structure

**MeetingRoom Object**:
```move
public struct MeetingRoom has key, store {
    id: UID,
    title: vector<u8>,              // UTF-8 encoded bytes
    participants: vector<address>,  // Initial whitelist (snapshot)
    require_approval: bool,
    seal_policy: SealApproveWhitelist,  // Embedded policy object
}
```

**SealApproveWhitelist Object**:
```move
public struct SealApproveWhitelist has key, store {
    id: UID,
    whitelist: vector<address>,     // Current allowed addresses
    updated_at: u64,                // Timestamp (ms) from Clock
}
```

### Address Validation Rules

Frontend validates Sui addresses before on-chain submission:
1. **Prefix**: Must start with `0x`
2. **Length**: 3-66 characters (including `0x`)
3. **Format**: Hexadecimal only (`[a-fA-F0-9]`)
4. **Uniqueness**: No duplicates in whitelist

### Clock Object (`0x6`)

- **Shared object** on all Sui networks (testnet, mainnet)
- Provides tamper-proof timestamps
- Used by `add_to_whitelist()` and `remove_from_whitelist()` to record update times
- No gas cost to reference (shared read)

## Environment Setup

### 1. Deploy Smart Contracts

```bash
cd suimeet
sui client publish --gas-budget 100000000
```

**Save Package ID** from output:
```
Published Objects:
  PackageID: 0xABC123...
```

### 2. Configure Frontend

Create `frontend-app/.env.local`:
```env
NEXT_PUBLIC_PACKAGE_ID=0xABC123...  # From step 1
NEXT_PUBLIC_SUI_RPC=https://fullnode.devnet.sui.io:443
```

### 3. Run Development Server

```bash
cd frontend-app
npm install
npm run dev
```

Visit `http://localhost:3000/room` to create your first room!

## Testing Checklist

### Host Side
- [ ] Create room with 2+ addresses in whitelist
- [ ] Verify room object created on Sui Explorer
- [ ] Copy invite link
- [ ] Approve a new guest address (not in initial list)
- [ ] Revoke an existing guest
- [ ] Check `updated_at` timestamp changes

### Guest Side
- [ ] Open invite link while **not connected** → Denied
- [ ] Connect wallet with **whitelisted address** → Approved
- [ ] Connect wallet with **non-whitelisted address** + approval required → Waiting
- [ ] Connect wallet with **non-whitelisted address** + no approval → Denied
- [ ] Refresh after host approves → Status changes to Approved

## Security Considerations

### On-Chain Validation
- **Host-only operations**: `approve_guest` and `revoke_guest` check sender is in `participants` array
- **No external calls**: All logic self-contained in Move contracts
- **Immutable history**: Every whitelist change recorded with timestamp

### Frontend Validation
- **Pre-transaction checks**: Address format validation prevents wasted gas
- **Real-time status**: Guest verification queries live blockchain state
- **No caching**: Always fetch latest whitelist from on-chain object

### Gas Estimation
- **Create room**: ~0.002 SUI (varies with whitelist size)
- **Approve guest**: ~0.0005 SUI
- **Revoke guest**: ~0.0005 SUI
- **Read-only queries**: Free (RPC calls, no transactions)

## Future Enhancements

1. **Batch Operations**
   - Approve/revoke multiple addresses in one transaction
   - Save gas for large whitelist updates

2. **Expiring Invites**
   - Add `expires_at` field to `SealApproveWhitelist`
   - Auto-deny access after expiry timestamp

3. **Role-Based Access**
   - Distinguish between "host" and "guest" roles
   - Co-hosts can approve guests

4. **Event Emission**
   - Emit events for whitelist changes
   - Build activity log UI from event history

5. **Seal SDK Integration**
   - Use Seal's IBE for true encrypted invites
   - Decrypt invite link only if whitelisted

## Troubleshooting

**Error: "Address must start with 0x"**
- Solution: Ensure addresses follow format `0xABC123...`

**Error: "Room not found"**
- Check room ID is correct
- Verify network (devnet vs testnet)
- Confirm object ID exists on Sui Explorer

**Transaction fails with "Assertion failed"**
- Code 0: `require_approval` is false (can't approve guests)
- Code 1: Sender is not a participant (not host)

**Whitelist not updating**
- Ensure Clock object ID is `0x6`
- Check transaction succeeded on Sui Explorer
- Refresh page to reload room data

## References

- [Sui Move Docs](https://docs.sui.io/guides/developer/first-app/write-package)
- [Seal SDK (Conceptual)](https://github.com/MystenLabs/sui/tree/main/examples)
- [Sui Clock Object](https://docs.sui.io/guides/developer/sui-101/shared-objects)
- [Frontend Integration](../frontend-app/src/app/room/page.tsx)

---

**Built with 💙 on Sui. Let's make meetings unstoppable.**
