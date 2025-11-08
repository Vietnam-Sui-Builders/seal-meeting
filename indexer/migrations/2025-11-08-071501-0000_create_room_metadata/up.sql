-- Room Metadata Table
-- Tracks dynamic field metadata for meeting rooms (language, timezone, recording blob)

CREATE TABLE room_metadata (
    id BIGSERIAL PRIMARY KEY,
    room_id VARCHAR(66) NOT NULL UNIQUE,
    dynamic_field_id VARCHAR(66) NOT NULL UNIQUE, -- The ObjectID of the dynamic field
    df_version BIGINT NOT NULL, -- Version of the dynamic field object
    language TEXT NOT NULL,
    timezone TEXT NOT NULL,
    recording_blob_id NUMERIC(78, 0), -- u256 stored as NUMERIC, nullable
    indexed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (room_id) REFERENCES meeting_rooms(room_id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX idx_room_metadata_room ON room_metadata(room_id);
CREATE INDEX idx_room_metadata_df_id ON room_metadata(dynamic_field_id);
CREATE INDEX idx_room_metadata_recording ON room_metadata(recording_blob_id) WHERE recording_blob_id IS NOT NULL;
