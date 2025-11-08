-- Room Participants Table
-- Tracks individual participants with roles (PARTICIPANT/HOST) and admin capabilities

CREATE TABLE room_participants (
    id BIGSERIAL PRIMARY KEY,
    room_id VARCHAR(66) NOT NULL,
    participant_address VARCHAR(66) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('PARTICIPANT', 'HOST')),
    admin_cap_id VARCHAR(66), -- HostCap object ID (only for HOSTs)
    joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(room_id, participant_address),
    FOREIGN KEY (room_id) REFERENCES meeting_rooms(room_id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX idx_room_participants_room ON room_participants(room_id);
CREATE INDEX idx_room_participants_address ON room_participants(participant_address);
CREATE INDEX idx_room_participants_role ON room_participants(room_id, role);
CREATE INDEX idx_room_participants_admin_cap ON room_participants(admin_cap_id) WHERE admin_cap_id IS NOT NULL;

-- Index for finding all rooms a user is in
CREATE INDEX idx_room_participants_user_rooms ON room_participants(participant_address, room_id);
