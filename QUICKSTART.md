# SuiMeet Quick Start Guide

Get your decentralized meeting platform running in 10 minutes!

## Prerequisites

- [Sui CLI](https://docs.sui.io/guides/developer/getting-started/sui-install) installed
- [Node.js](https://nodejs.org/) v18+ installed
- Sui Wallet browser extension
- Some testnet SUI tokens (from [faucet](https://discord.gg/sui))

## Step 1: Deploy Smart Contracts

```powershell
# Navigate to contract directory
cd suimeet

# Publish to devnet
sui client publish --gas-budget 100000000
```

**Important**: Save the Package ID from the output:
```
Published Objects:
  PackageID: 0x123abc...
```

## Step 2: Configure Frontend

```powershell
# Navigate to frontend
cd ..\frontend-app

# Copy environment template
copy .env.example .env.local

# Open .env.local and update:
# NEXT_PUBLIC_PACKAGE_ID=0x123abc...  (from Step 1)
```

## Step 3: Install & Run

```powershell
# Install dependencies
npm install

# Start development server
npm run dev
```

Visit **http://localhost:3000** 🚀

## Step 4: Create Your First Room

1. **Connect Wallet** 
   - Click "Connect Wallet" in navbar
   - Select Sui Wallet and approve

2. **Navigate to `/room`**
   - Click or type in browser: `http://localhost:3000/room`

3. **Fill Meeting Details**
   - Title: "My First SuiMeet"
   - Date: Tomorrow
   - Time: 14:00
   - Duration: 60 minutes

4. **Add Participants**
   - Add your friend's Sui address (starts with `0x`)
   - Or add another wallet you control for testing
   - Click the + button

5. **Create Room**
   - Click "Create & Seal Invite"
   - Approve transaction in wallet
   - Wait for confirmation (~2 seconds on devnet)

6. **Share Invite**
   - Copy the invite link
   - Send to participants

## Step 5: Test Guest Access

**As Guest**:
1. Open invite link in incognito/private window
2. Connect different wallet (the one you whitelisted)
3. See "Access Approved" ✅
4. Click "Join Meeting Now"

**As Non-Whitelisted Guest**:
1. Open invite link with random wallet
2. See "Waiting for Host Approval" or "Access Denied" ⚠️

## What You Just Built

- ✅ On-chain meeting room with tamper-proof whitelist
- ✅ Host-controlled access management (approve/revoke)
- ✅ Guest verification against blockchain
- ✅ Real-time whitelist updates (~1 sec confirmation)

## Next Steps

### Verify on Sui Explorer

Visit [Sui Explorer (Devnet)](https://suiscan.xyz/devnet) and search for:
- Your Room ID (object ID from invite link)
- Check `seal_policy.whitelist` field
- View transaction history

### Add More Features

**Waiting Room** (future):
- Guests wait in lobby until host approves
- Real-time status updates

**Video/Audio** (future):
- Integrate Sui Stack Messaging SDK for P2P calls
- Encrypted streams with WebRTC

**POAP NFTs** (future):
- Mint attendance badges after meeting ends
- Gated by whitelist verification

## Troubleshooting

### "Transaction failed"
- **Solution**: Get more testnet SUI from Discord faucet
- Check gas budget: Should be ~100,000,000 MIST (0.1 SUI)

### "Room not found"
- **Solution**: Verify Room ID copied correctly
- Check you're on same network (devnet vs testnet)

### "Address must start with 0x"
- **Solution**: Copy full Sui address from wallet
- Format: `0xABC123...` (hex)

### npm run dev fails
- **Solution**: Delete `node_modules` and `package-lock.json`
- Run `npm install` again

## Architecture Recap

```
┌─────────────┐      Creates       ┌──────────────────┐
│   Host UI   │ ─────────────────> │  MeetingRoom     │
│  (/room)    │                    │  (Shared Object) │
└─────────────┘                    └──────────────────┘
                                            │
                                            │ Contains
                                            ▼
                                   ┌──────────────────┐
                                   │ SealApprove      │
                                   │ Whitelist        │
                                   │ - whitelist[]    │
                                   │ - updated_at     │
                                   └──────────────────┘
                                            ▲
                                            │ Verifies
┌─────────────┐      Checks        ┌───────┴──────────┐
│  Guest UI   │ ─────────────────> │   Sui RPC        │
│ (/room/join)│                    │  (Read-only)     │
└─────────────┘                    └──────────────────┘
```

## Resources

- [Full Documentation](./docs/ROOM_WHITELIST_FLOW.md)
- [Sui Move Docs](https://docs.sui.io/guides/developer)
- [SuiMeet Contract](./suimeet/sources/suimeet.move)
- [Discord Support](https://discord.gg/sui) - #dev-help channel

---

**Questions?** Check `docs/ROOM_WHITELIST_FLOW.md` for detailed flow explanations.

**Ready to ship?** Deploy contracts to testnet/mainnet and update `.env.local` RPC URL!
