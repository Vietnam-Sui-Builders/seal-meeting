# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview
SuiMeet is a decentralized video meeting platform built on Sui blockchain, combining Zoom-like functionality with Web3 features like wallet-based access control, NFT attendance badges (POAPs), and end-to-end encrypted communications.

## Architecture
- **Frontend**: Next.js 15 app in `frontend-app/` with React 19, Tailwind CSS 4, TypeScript
- **Blockchain Integration**: Sui blockchain with Move smart contracts (contracts not yet implemented)
- **Authentication**: Sui Wallet Kit + zkLogin for passwordless auth via Google OAuth
- **Storage**: Planned Walrus integration for decentralized file sharing
- **Communication**: Sui Stack Messaging SDK (alpha) for P2P video/audio/chat

## Development Commands

### Frontend Development (in frontend-app/)
```powershell
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production  
npm run build

# Start production server
npm start
```

### Smart Contract Development
Smart contracts are not yet implemented. When available, use:
```powershell
# Deploy contracts (from contracts directory)
sui client publish --gas-budget 100000000

# Switch to testnet
sui client switch --env testnet
```

## Key Dependencies
- **@mysten/dapp-kit**: Sui dApp integration
- **@mysten/sui.js**: Sui blockchain client
- **@mysten/zklogin**: Zero-knowledge login implementation
- **@suiet/wallet-kit**: Wallet connection utilities
- **@react-oauth/google**: Google OAuth integration
- **framer-motion**: Animation library
- **zustand**: State management

## Environment Configuration
Required environment variables (`.env.local`):
```
NEXT_PUBLIC_SUI_RPC=https://fullnode.testnet.sui.io:443
NEXT_PUBLIC_WALRUS_ENDPOINT=https://api.walrus.network
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
```

## Code Structure
```
frontend-app/
├── src/
│   ├── app/               # Next.js App Router pages
│   ├── components/        # Reusable React components
│   │   └── general/       # General UI components
│   ├── provider/          # React context providers
│   └── @types/           # TypeScript type definitions
│       └── props/        # Component prop interfaces
├── public/               # Static assets
└── config files         # Next.js, TypeScript, Tailwind configs
```

## Key Components
- **BaseProvider.tsx**: Main app provider wrapping SuiClientProvider, WalletProvider, GoogleOAuthProvider
- **ConnectWalletModal.tsx**: Wallet connection UI with zkLogin and Sui wallet options
- **Navbar.tsx**: Navigation with wallet connection status

## Development Patterns
- Uses Next.js App Router (not Pages Router)
- Client components marked with `'use client'` directive
- Absolute imports using `@/*` paths (configured in tsconfig.json)
- Tailwind CSS for styling with utility classes
- Component interfaces defined in separate TypeScript files

## Blockchain Integration Notes
- Currently configured for Sui testnet
- Smart contracts referenced in README but not yet implemented
- zkLogin integration partially implemented (TODO comments present)
- Wallet connection uses @mysten/dapp-kit ConnectModal

## Testing
No test framework currently configured. When implementing tests, follow the project's phased development plan from README.md.

## Development Phases
Per project README, development follows 4 phases:
1. Foundation (Setup & Seal Auth) - 1 week
2. Calling Core with Messaging SDK - 1-2 weeks  
3. Web3 Polish (POAP minting, encryption) - 1 week
4. Analytics & Launch - 1 week

## Common Issues
- zkLogin implementation contains TODOs and placeholder logic
- Smart contracts not yet deployed
- Environment variables need to be configured for full functionality
- Sui Stack Messaging SDK integration pending (alpha status noted in README)

## Prerequisites for Development
- Node.js v18+
- Sui CLI (`cargo install sui`)
- Sui Wallet browser extension
- Google OAuth credentials for zkLogin