# SuiMeet Indexer

Production-grade indexer for SuiMeet meeting room events using Sui's Custom Indexing Framework.

## Overview

This indexer tracks all meeting room events on-chain and stores them in PostgreSQL for efficient querying. It processes:

- **RoomCreated**: New meeting rooms
- **RoomStarted**: When meetings begin
- **RoomEnded**: When meetings conclude
- **GuestApproved**: When hosts approve participants
- **GuestRevoked**: When hosts revoke access

## Architecture

```
Sui Blockchain → Indexer Framework → PostgreSQL → Your Application
                  (Event Processing)   (Structured Data)
```

### Components

- **Event Parsers** (`src/events/`): Type-safe BCS deserialization of Move events
- **Processors** (`src/processors/`): Transform events into database operations
- **Database Models** (`src/db/`): Diesel ORM models for PostgreSQL
- **Migrations** (`migrations/`): Database schema definitions

## Setup

### 1. Install Dependencies

```bash
# Install PostgreSQL (macOS)
brew install postgresql@14
brew services start postgresql@14

# Install Diesel CLI
cargo install diesel_cli --no-default-features --features postgres

# Install Rust (if needed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 2. Create Database

```bash
# Create database
createdb suimeet_indexer

# Or with psql
psql postgres
CREATE DATABASE suimeet_indexer;
\q
```

### 3. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your settings
DATABASE_URL=postgres://localhost/suimeet_indexer
SUIMEET_PACKAGE_ID=0x<your_package_id>
RPC_URL=https://fullnode.testnet.sui.io:443
```

### 4. Run Migrations

```bash
diesel migration run
```

### 5. Build

```bash
cargo build --release
```

## Running the Indexer

### Development Mode

```bash
cargo run -- \
  --database-url postgres://localhost/suimeet_indexer \
  --suimeet-package-id 0x9a6a02f8b4d3cca7ba7e2a4488ff49089147c1a26b882c08887595b489eb3625 \
  --rpc-url https://fullnode.testnet.sui.io:443
```

### Production Mode

```bash
./target/release/suimeet-indexer \
  --database-url $DATABASE_URL \
  --suimeet-package-id $SUIMEET_PACKAGE_ID \
  --rpc-url $RPC_URL
```

### With Custom Checkpoint Range

```bash
# Index from checkpoint 1000 to 2000
./target/release/suimeet-indexer \
  --database-url $DATABASE_URL \
  --suimeet-package-id $SUIMEET_PACKAGE_ID \
  --rpc-url $RPC_URL \
  --first-checkpoint 1000 \
  --last-checkpoint 2000
```

## Database Schema

### meeting_rooms Table

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| room_id | VARCHAR(66) | Unique Sui object ID |
| title | TEXT | Meeting title |
| hosts | VARCHAR[] | Array of host addresses |
| seal_policy_id | VARCHAR(66) | Seal policy ID (meeting code) |
| status | SMALLINT | 1=scheduled, 2=active, 3=ended |
| max_participants | BIGINT | Maximum allowed participants |
| require_approval | BOOLEAN | Whether approval is required |
| participant_count | INTEGER | Current number of participants |
| created_at | BIGINT | Creation timestamp (ms) |
| started_at | BIGINT | Start timestamp (ms) |
| ended_at | BIGINT | End timestamp (ms) |
| checkpoint_sequence_number | BIGINT | Sui checkpoint number |
| transaction_digest | VARCHAR(64) | Transaction hash |
| indexed_at | TIMESTAMP | When indexed |
| updated_at | TIMESTAMP | Last updated |

## Querying Data

### SQL Examples

```sql
-- Get all active meetings
SELECT * FROM meeting_rooms
WHERE status = 2
ORDER BY created_at DESC;

-- Get meetings by host
SELECT * FROM meeting_rooms
WHERE '0xhost_address' = ANY(hosts)
ORDER BY created_at DESC;

-- Get meetings requiring approval
SELECT * FROM meeting_rooms
WHERE require_approval = true
AND status IN (1, 2);

-- Get meeting by seal policy ID (meeting code)
SELECT * FROM meeting_rooms
WHERE seal_policy_id = '0x...';

-- Get meeting statistics
SELECT
  status,
  COUNT(*) as count,
  AVG(participant_count) as avg_participants
FROM meeting_rooms
GROUP BY status;
```

### Building a GraphQL API

Use PostGraphile or Hasura to auto-generate a GraphQL API:

```bash
# Install PostGraphile
npm install -g postgraphile

# Run GraphQL server
postgraphile -c postgres://localhost/suimeet_indexer \
  --schema public \
  --watch \
  --enhance-graphiql \
  --dynamic-json
```

Then query via GraphQL:

```graphql
query GetActiveMeetings {
  meetingRooms(
    condition: { status: 2 }
    orderBy: CREATED_AT_DESC
  ) {
    nodes {
      roomId
      title
      hosts
      sealPolicyId
      participantCount
      createdAt
    }
  }
}

query GetMeetingByCode($code: String!) {
  meetingRooms(
    condition: { sealPolicyId: $code }
  ) {
    nodes {
      roomId
      title
      hosts
      status
      participantCount
      maxParticipants
    }
  }
}
```

## Monitoring

### Check Indexer Progress

```sql
-- Latest indexed checkpoint
SELECT MAX(checkpoint_sequence_number) as latest_checkpoint
FROM meeting_rooms;

-- Indexing rate
SELECT
  COUNT(*) as rooms_indexed,
  MAX(checkpoint_sequence_number) - MIN(checkpoint_sequence_number) as checkpoints_processed,
  MAX(indexed_at) - MIN(indexed_at) as time_taken
FROM meeting_rooms
WHERE indexed_at > NOW() - INTERVAL '1 hour';
```

### Logs

The indexer uses `tracing` for structured logging:

```bash
# Set log level
RUST_LOG=info cargo run

# Debug mode
RUST_LOG=debug cargo run

# Only show indexer logs
RUST_LOG=suimeet_indexer=debug cargo run
```

## Performance Tuning

### Indexer Settings

```bash
# Faster ingestion (more concurrent requests)
--ingest-concurrency 500

# Larger checkpoint buffer
--checkpoint-buffer-size 10000

# Faster retries
--retry-interval-ms 100
```

### Database Optimization

```sql
-- Add custom indexes
CREATE INDEX idx_meeting_rooms_status_created
ON meeting_rooms(status, created_at DESC);

CREATE INDEX idx_meeting_rooms_hosts_gin
ON meeting_rooms USING GIN(hosts);

-- Analyze tables
ANALYZE meeting_rooms;

-- Vacuum if needed
VACUUM ANALYZE meeting_rooms;
```

## Troubleshooting

### Issue: Indexer falls behind

**Solution**: Increase concurrency and buffer size

```bash
--ingest-concurrency 1000 \
--checkpoint-buffer-size 20000
```

### Issue: Database connection errors

**Solution**: Check PostgreSQL connection limits

```sql
-- Check current connections
SELECT count(*) FROM pg_stat_activity;

-- Increase max connections (postgresql.conf)
max_connections = 200
```

### Issue: Events not being indexed

**Solution**: Verify package ID

```bash
# Check contract deployment
sui client object <PACKAGE_ID>

# Verify events are emitted
sui client events --package <PACKAGE_ID>
```

## Development

### Adding New Event Types

1. **Define event struct** in `src/events/meeting_events.rs`:
```rust
#[derive(Debug, Clone, Serialize, Deserialize, BcsExt)]
pub struct HostAdded {
    pub room_id: [u8; 32],
    pub new_host: [u8; 32],
    pub added_at: u64,
}
```

2. **Add to enum** in `src/events/mod.rs`:
```rust
pub enum MeetingRoomEvent {
    // ...
    HostAdded(HostAdded),
}
```

3. **Update processor** in `src/processors/room_processor.rs`:
```rust
MeetingRoomEvent::HostAdded(host) => {
    // Process event
}
```

### Running Tests

```bash
# Unit tests
cargo test

# Integration tests with database
cargo test --features integration-tests
```

## Production Deployment

### Docker

```bash
# Build image
docker build -t suimeet-indexer .

# Run container
docker run -d \
  --name suimeet-indexer \
  -e DATABASE_URL=postgres://... \
  -e SUIMEET_PACKAGE_ID=0x... \
  -e RPC_URL=https://... \
  suimeet-indexer
```

### Systemd Service

```ini
# /etc/systemd/system/suimeet-indexer.service
[Unit]
Description=SuiMeet Indexer
After=network.target postgresql.service

[Service]
Type=simple
User=indexer
WorkingDirectory=/opt/suimeet-indexer
EnvironmentFile=/opt/suimeet-indexer/.env
ExecStart=/opt/suimeet-indexer/suimeet-indexer
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable suimeet-indexer
sudo systemctl start suimeet-indexer
sudo systemctl status suimeet-indexer
```

## License

MIT

## Support

For issues or questions, open an issue on GitHub.
