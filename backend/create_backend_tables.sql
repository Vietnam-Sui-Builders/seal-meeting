-- Backend-only tables for SuiMeet
-- Run this manually: psql postgresql://s6klabs@localhost:5432/sealmeet < create_backend_tables.sql

-- User table
CREATE TABLE IF NOT EXISTS "User" (
    id TEXT PRIMARY KEY,
    "primaryWalletAddress" VARCHAR(100),
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "User_primaryWalletAddress_idx" ON "User"("primaryWalletAddress");

-- Wallet table
CREATE TABLE IF NOT EXISTS "Wallet" (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    address VARCHAR(100) NOT NULL UNIQUE,
    type TEXT NOT NULL DEFAULT 'sui',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "Wallet_userId_idx" ON "Wallet"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Wallet_address_key" ON "Wallet"(address);

-- AuthNonce table
CREATE TABLE IF NOT EXISTS "AuthNonce" (
    id TEXT PRIMARY KEY,
    "walletAddress" VARCHAR(100) NOT NULL,
    nonce VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP NOT NULL,
    "consumedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "AuthNonce_walletAddress_idx" ON "AuthNonce"("walletAddress");
CREATE INDEX IF NOT EXISTS "AuthNonce_expiresAt_idx" ON "AuthNonce"("expiresAt");

-- Session table
CREATE TABLE IF NOT EXISTS "Session" (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "jwtId" VARCHAR(255) NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "expiresAt" TIMESTAMP NOT NULL,
    "lastUsedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    ip VARCHAR(64),
    ua VARCHAR(512),
    "encryptedPrivateKey" TEXT,
    "lastPolicyUpdateAt" TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE,
    FOREIGN KEY ("walletId") REFERENCES "Wallet"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Session_walletId_idx" ON "Session"("walletId");
CREATE INDEX IF NOT EXISTS "Session_status_idx" ON "Session"(status);
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");

-- RefreshToken table
CREATE TABLE IF NOT EXISTS "RefreshToken" (
    id TEXT PRIMARY KEY,
    "sessionId" TEXT NOT NULL UNIQUE,
    "tokenHash" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP NOT NULL,
    "revokedAt" TIMESTAMP,
    "rotationCounter" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("sessionId") REFERENCES "Session"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- EphemeralKey table
CREATE TABLE IF NOT EXISTS "EphemeralKey" (
    id TEXT PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "publicKey" VARCHAR(256) NOT NULL,
    "encryptedPublicKey" VARCHAR(512),
    alg VARCHAR(64) NOT NULL,
    scope VARCHAR(512) NOT NULL,
    "issuedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "expiresAt" TIMESTAMP NOT NULL,
    "revokedAt" TIMESTAMP,
    FOREIGN KEY ("sessionId") REFERENCES "Session"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "EphemeralKey_sessionId_idx" ON "EphemeralKey"("sessionId");
CREATE INDEX IF NOT EXISTS "EphemeralKey_expiresAt_idx" ON "EphemeralKey"("expiresAt");

-- DelegatedSignature table
CREATE TABLE IF NOT EXISTS "DelegatedSignature" (
    id TEXT PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "txTemplateHash" VARCHAR(128) NOT NULL,
    signature VARCHAR(1024) NOT NULL,
    scope VARCHAR(512) NOT NULL,
    "expiresAt" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("sessionId") REFERENCES "Session"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "DelegatedSignature_sessionId_idx" ON "DelegatedSignature"("sessionId");
CREATE INDEX IF NOT EXISTS "DelegatedSignature_expiresAt_idx" ON "DelegatedSignature"("expiresAt");

-- ApprovalRequest table (links to indexed meeting_rooms)
CREATE TABLE IF NOT EXISTS "ApprovalRequest" (
    id TEXT PRIMARY KEY,
    room_id VARCHAR(66) NOT NULL,
    requester_address VARCHAR(100) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP,
    resolver_address VARCHAR(100),
    resolution_tx_digest VARCHAR(128),
    FOREIGN KEY (room_id) REFERENCES meeting_rooms(room_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ApprovalRequest_roomId_idx" ON "ApprovalRequest"(room_id);
CREATE INDEX IF NOT EXISTS "ApprovalRequest_status_idx" ON "ApprovalRequest"(status);
CREATE INDEX IF NOT EXISTS "ApprovalRequest_requesterAddress_idx" ON "ApprovalRequest"(requester_address);

-- Grant permissions (if needed)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO s6klabs;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO s6klabs;
