#!/bin/bash

# Export logging configuration
export RUST_BACKTRACE="${RUST_BACKTRACE:-1}"
export RUST_LOG="${RUST_LOG:-info,sealmeet_indexer=debug}"

# Build command with all required arguments
CMD="/opt/mysten/bin/sealmeet-indexer"

# Required arguments
CMD="$CMD --database-url \"$DATABASE_URL\""
CMD="$CMD --package-id \"$PACKAGE_ID\""

# Ingestion configuration (with defaults)
CMD="$CMD --checkpoint-buffer-size ${CHECKPOINT_BUFFER_SIZE:-5000}"
CMD="$CMD --ingest-concurrency ${INGEST_CONCURRENCY:-200}"
CMD="$CMD --retry-interval-ms ${RETRY_INTERVAL_MS:-200}"

# Sui network configuration - ONE of these is required
if [ -n "$REMOTE_STORE_URL" ]; then
    CMD="$CMD --remote-store-url \"$REMOTE_STORE_URL\""
elif [ -n "$RPC_API_URL" ]; then
    CMD="$CMD --rpc-url \"$RPC_API_URL\""
    [ -n "$RPC_USERNAME" ] && CMD="$CMD --rpc-username \"$RPC_USERNAME\""
    [ -n "$RPC_PASSWORD" ] && CMD="$CMD --rpc-password \"$RPC_PASSWORD\""
elif [ -n "$LOCAL_INGESTION_PATH" ]; then
    CMD="$CMD --local-ingestion-path \"$LOCAL_INGESTION_PATH\""
else
    echo "ERROR: No Sui network configuration provided!"
    echo "Please set one of: REMOTE_STORE_URL, RPC_API_URL, or LOCAL_INGESTION_PATH"
    exit 1
fi

# Optional checkpoint range
[ -n "$FIRST_CHECKPOINT" ] && CMD="$CMD --first-checkpoint $FIRST_CHECKPOINT"
[ -n "$LAST_CHECKPOINT" ] && CMD="$CMD --last-checkpoint $LAST_CHECKPOINT"

echo "Starting SealMeet Indexer with configuration:"
echo "DATABASE_URL: ${DATABASE_URL%%@*}@***"
echo "PACKAGE_ID: $PACKAGE_ID"
echo "REMOTE_STORE_URL: $REMOTE_STORE_URL"
echo "CHECKPOINT_BUFFER_SIZE: ${CHECKPOINT_BUFFER_SIZE:-5000}"
echo "INGEST_CONCURRENCY: ${INGEST_CONCURRENCY:-200}"
echo ""

# Execute the command
eval $CMD
