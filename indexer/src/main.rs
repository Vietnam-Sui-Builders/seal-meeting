// SuiMeet Indexer - Meeting Room Event Indexer

use clap::{Parser, Args as ClapArgs};
use sui_indexer_alt_framework::{
    cluster::{self, IndexerClusterBuilder},
    pipeline::sequential::SequentialConfig,
    ingestion::IngestionConfig,
    Result,
};
use url::Url;
use suimeet_indexer::{
    processors::{RoomProcessor, MetadataProcessor},
    MIGRATIONS,
};

/// Ingestion configuration arguments
#[derive(ClapArgs, Debug, Clone)]
struct IngestionArgs {
    /// Maximum size of checkpoint backlog
    #[clap(long, env = "CHECKPOINT_BUFFER_SIZE", default_value = "5000")]
    checkpoint_buffer_size: usize,

    /// Maximum number of checkpoints to fetch concurrently
    #[clap(long, env = "INGEST_CONCURRENCY", default_value = "200")]
    ingest_concurrency: usize,

    /// Polling interval to retry fetching checkpoints (ms)
    #[clap(long, env = "RETRY_INTERVAL_MS", default_value = "200")]
    retry_interval_ms: u64,
}

impl From<IngestionArgs> for IngestionConfig {
    fn from(args: IngestionArgs) -> Self {
        IngestionConfig {
            checkpoint_buffer_size: args.checkpoint_buffer_size,
            ingest_concurrency: args.ingest_concurrency,
            retry_interval_ms: args.retry_interval_ms,
        }
    }
}

#[derive(Parser, Debug)]
#[clap(
    name = "suimeet-indexer",
    about = "Sequential pipeline indexer for SuiMeet meeting rooms using Sui Custom Indexing Framework",
    version
)]
struct Args {
    /// PostgreSQL database URL
    #[clap(long, env = "DATABASE_URL")]
    database_url: Url,

    /// SuiMeet package ID on Sui
    #[clap(long, env = "SUIMEET_PACKAGE_ID")]
    suimeet_package_id: String,

    #[clap(flatten)]
    cluster_args: cluster::Args,

    #[clap(flatten)]
    ingestion_args: IngestionArgs,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Load .env file BEFORE parsing args so clap can see env vars
    dotenvy::dotenv().ok();

    let Args {
        database_url,
        suimeet_package_id,
        cluster_args,
        ingestion_args,
    } = Args::parse();

    // Build and configure the indexer cluster with framework's builder
    let mut indexer = IndexerClusterBuilder::new()
        .with_ingestion_config(IngestionConfig::from(ingestion_args))
        .with_database_url(database_url)
        .with_args(cluster_args)
        .with_migrations(&MIGRATIONS)
        .build()
        .await?;

    // Create and register room processor
    let room_processor = RoomProcessor::new(suimeet_package_id.clone())?;

    indexer
        .sequential_pipeline(room_processor, SequentialConfig::default())
        .await?;

    // Create and register metadata processor
    let metadata_processor = MetadataProcessor::new(suimeet_package_id)?;

    indexer
        .sequential_pipeline(metadata_processor, SequentialConfig::default())
        .await?;

    // Start the indexer and wait for completion
    let _ = indexer.run().await?.await;

    Ok(())
}
