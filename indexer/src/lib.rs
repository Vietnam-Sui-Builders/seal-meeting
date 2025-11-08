// Copyright (c) SmashBlob Team
// SPDX-License-Identifier: MIT

use diesel_migrations::{embed_migrations, EmbeddedMigrations};

pub mod db;
pub mod events;
pub mod utils;
pub mod processors;
pub mod models;  // Move-binding generated types

// Embed database migrations into the binary so they run automatically on startup
pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");
