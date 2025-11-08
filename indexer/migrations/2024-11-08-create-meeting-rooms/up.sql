-- Meeting Rooms Table
CREATE TABLE meeting_rooms (
    id BIGSERIAL PRIMARY KEY,
    room_id VARCHAR(66) NOT NULL UNIQUE,
    title TEXT NOT NULL,
    hosts VARCHAR(66)[] NOT NULL DEFAULT ARRAY[]::VARCHAR[], -- Array of host addresses
    seal_policy_id VARCHAR(66) NOT NULL UNIQUE,
    status SMALLINT NOT NULL DEFAULT 1, -- 1: scheduled, 2: active, 3: ended
    max_participants BIGINT NOT NULL,
    require_approval BOOLEAN NOT NULL DEFAULT false,
    participant_count INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    started_at BIGINT,
    ended_at BIGINT,
    checkpoint_sequence_number BIGINT NOT NULL,
    transaction_digest VARCHAR(64) NOT NULL,
    indexed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_meeting_rooms_hosts ON meeting_rooms USING GIN(hosts); -- GIN index for array queries
CREATE INDEX idx_meeting_rooms_status ON meeting_rooms(status);
CREATE INDEX idx_meeting_rooms_seal_policy_id ON meeting_rooms(seal_policy_id);
CREATE INDEX idx_meeting_rooms_created_at ON meeting_rooms(created_at DESC);
CREATE INDEX idx_meeting_rooms_checkpoint ON meeting_rooms(checkpoint_sequence_number);
CREATE INDEX idx_meeting_rooms_status_created ON meeting_rooms(status, created_at DESC);
