// Copyright (c) SmashBlob Team
// SPDX-License-Identifier: MIT

//! Type conversion utilities for Move types to PostgreSQL types

use anyhow::{Result, Context};
use bigdecimal::BigDecimal;
use num_bigint::BigUint;
use sui_indexer_alt_framework::types::base_types::SuiAddress;
use serde::{Deserialize, Serialize};
use std::fmt;

/// The ID of a blob (u256 in Move, represented as 32 bytes)
///
/// BlobId represents a unique identifier for blobs stored on Walrus.
/// In Move contracts, this is represented as a u256 value, which serializes
/// to 32 bytes in BCS format.
///
/// # Examples
///
/// ```rust,ignore
/// use smashblob_indexer_alt::utils::BlobId;
///
/// let blob_id = BlobId([1u8; 32]);
/// println!("Blob ID: {:?}", blob_id);
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, Hash)]
#[repr(transparent)]
pub struct BlobId(pub [u8; 32]);

impl BlobId {
    /// Create a new BlobId from a 32-byte array
    pub const fn new(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }

    /// Get the inner byte array
    pub const fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }

    /// Convert to a hex string with 0x prefix
    ///
    /// # Examples
    ///
    /// ```rust,ignore
    /// let blob_id = BlobId([0xFF; 32]);
    /// assert_eq!(&blob_id.to_hex_string()[0..4], "0xff");
    /// ```
    pub fn to_hex_string(&self) -> String {
        format!("0x{}", hex::encode(self.0))
    }

    /// Convert BlobId (u256) to BigDecimal for PostgreSQL storage
    ///
    /// Move's u256 is stored as a 32-byte array in little-endian format.
    /// This converts it to a BigDecimal that can be stored in PostgreSQL's NUMERIC type.
    ///
    /// # Returns
    ///
    /// * `Ok(BigDecimal)` - The converted value
    /// * `Err(...)` - If conversion fails
    ///
    /// # Examples
    ///
    /// ```rust,ignore
    /// let blob_id = BlobId([1, 0, 0, ..., 0]); // Value 1 in little-endian
    /// let decimal = blob_id.to_bigdecimal()?;
    /// assert_eq!(decimal, BigDecimal::from(1));
    /// ```
    pub fn to_bigdecimal(&self) -> Result<BigDecimal> {
        // Convert little-endian bytes to BigUint
        let big_uint = BigUint::from_bytes_le(&self.0);

        // Convert to string and then to BigDecimal
        let decimal_string = big_uint.to_string();
        decimal_string.parse::<BigDecimal>()
            .context("Failed to parse u256 as BigDecimal")
    }

    /// Zero blob ID (all zeros)
    pub const ZERO: Self = Self([0u8; 32]);
}

impl fmt::Display for BlobId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.to_hex_string())
    }
}

impl From<[u8; 32]> for BlobId {
    fn from(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }
}

impl From<BlobId> for [u8; 32] {
    fn from(blob_id: BlobId) -> Self {
        blob_id.0
    }
}

impl AsRef<[u8]> for BlobId {
    fn as_ref(&self) -> &[u8] {
        &self.0
    }
}

/// Convert Move u256 (32-byte array) to BigDecimal for PostgreSQL NUMERIC
///
/// Move's u256 is stored as a 32-byte array in little-endian format.
/// We convert this to a BigDecimal so it can be stored in PostgreSQL.
///
/// # Arguments
///
/// * `bytes` - 32-byte array representing a u256 value
///
/// # Returns
///
/// * `Ok(BigDecimal)` - The converted value
/// * `Err(...)` - If conversion fails
///
/// # Examples
///
/// ```rust,ignore
/// let blob_id = [0xFF; 32]; // Max u256
/// let decimal = u256_to_bigdecimal(&blob_id)?;
/// ```
pub fn u256_to_bigdecimal(bytes: &[u8; 32]) -> Result<BigDecimal> {
    // Convert little-endian bytes to BigUint
    let big_uint = BigUint::from_bytes_le(bytes);

    // Convert to string and then to BigDecimal
    let decimal_string = big_uint.to_string();
    decimal_string.parse::<BigDecimal>()
        .context("Failed to parse u256 as BigDecimal")
}

/// Convert Move u256 (32-byte array) to hex string
///
/// Useful for displaying blob IDs and prompt IDs as human-readable strings.
///
/// # Arguments
///
/// * `bytes` - 32-byte array representing a u256 value
///
/// # Returns
///
/// A hex string with "0x" prefix
///
/// # Examples
///
/// ```rust,ignore
/// let blob_id = [0x12, 0x34, ...];
/// let hex = u256_to_hex_string(&blob_id);
/// assert_eq!(&hex[0..4], "0x12");
/// ```
pub fn u256_to_hex_string(bytes: &[u8; 32]) -> String {
    let hex = bytes.iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>();
    format!("0x{}", hex)
}


/// Convert Move String (Vec<u8> UTF-8 bytes) to Rust String
///
/// Move's String type is represented as a Vec<u8> of UTF-8 bytes.
///
/// # Arguments
///
/// * `bytes` - UTF-8 encoded bytes
///
/// # Returns
///
/// * `Ok(String)` - The decoded string
/// * `Err(...)` - If bytes are not valid UTF-8
///
/// # Examples
///
/// ```rust,ignore
/// let move_string = b"Hello, SmashBlob!".to_vec();
/// let rust_string = move_string_to_rust(&move_string)?;
/// assert_eq!(rust_string, "Hello, SmashBlob!");
/// ```
pub fn move_string_to_rust(bytes: &[u8]) -> Result<String> {
    String::from_utf8(bytes.to_vec())
        .context("Move string is not valid UTF-8")
}

/// Convert MIST (smallest SUI unit) to SUI for display
///
/// 1 SUI = 1,000,000,000 MIST
///
/// # Arguments
///
/// * `mist` - Amount in MIST
///
/// # Returns
///
/// Amount in SUI as a decimal
///
/// # Examples
///
/// ```rust,ignore
/// let sui = mist_to_sui(100_000_000); // 0.1 SUI
/// assert_eq!(sui, BigDecimal::from_str("0.1").unwrap());
/// ```
pub fn mist_to_sui(mist: u64) -> BigDecimal {
    BigDecimal::from(mist) / BigDecimal::from(1_000_000_000)
}

/// Convert SUI to MIST for calculations
///
/// # Arguments
///
/// * `sui` - Amount in SUI
///
/// # Returns
///
/// * `Ok(u64)` - Amount in MIST
/// * `Err(...)` - If conversion overflows u64
pub fn sui_to_mist(sui: &BigDecimal) -> Result<u64> {
    let mist = sui * BigDecimal::from(1_000_000_000);
    let mist_u64 = mist.to_string().parse::<u64>()
        .context("SUI amount too large to convert to MIST (u64 overflow)")?;
    Ok(mist_u64)
}

/// Helper to convert move_types::U256 to BlobId
pub fn u256_to_blob_id(u256: &move_types::U256) -> BlobId {
    // Convert move_types::U256 to bytes
    BlobId(u256.to_le_bytes())
}

/// Helper to convert move_types Address to SuiAddress
pub fn address_to_sui_address(addr: &move_types::Address) -> SuiAddress {
    // move_types::Address is just a re-export of sui_sdk_types::Address
    SuiAddress::from(*addr)
}


#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn test_u256_to_bigdecimal_zero() {
        let bytes = [0u8; 32];
        let decimal = u256_to_bigdecimal(&bytes).unwrap();
        assert_eq!(decimal, BigDecimal::from(0));
    }

    #[test]
    fn test_u256_to_bigdecimal_small_value() {
        let mut bytes = [0u8; 32];
        bytes[0] = 42; // 42 in little-endian
        let decimal = u256_to_bigdecimal(&bytes).unwrap();
        assert_eq!(decimal, BigDecimal::from(42));
    }

    #[test]
    fn test_u256_to_bigdecimal_large_value() {
        let bytes = [0xFF; 32]; // Max u256
        let decimal = u256_to_bigdecimal(&bytes).unwrap();

        // Max u256 = 2^256 - 1
        let expected = BigDecimal::from_str(
            "115792089237316195423570985008687907853269984665640564039457584007913129639935"
        ).unwrap();

        assert_eq!(decimal, expected);
    }

    #[test]
    fn test_u256_to_hex_string() {
        let mut bytes = [0u8; 32];
        bytes[0] = 0x12;
        bytes[1] = 0x34;
        bytes[31] = 0xAB;

        let hex = u256_to_hex_string(&bytes);
        assert!(hex.starts_with("0x1234"));
        assert!(hex.ends_with("ab"));
        assert_eq!(hex.len(), 66); // "0x" + 64 hex chars
    }

    #[test]
    fn test_move_string_to_rust_valid_utf8() {
        let bytes = b"Hello, SmashBlob!".to_vec();
        let s = move_string_to_rust(&bytes).unwrap();
        assert_eq!(s, "Hello, SmashBlob!");
    }

    #[test]
    fn test_move_string_to_rust_invalid_utf8() {
        let bytes = vec![0xFF, 0xFE, 0xFD]; // Invalid UTF-8
        let result = move_string_to_rust(&bytes);
        assert!(result.is_err());
    }

    #[test]
    fn test_mist_to_sui() {
        assert_eq!(mist_to_sui(1_000_000_000), BigDecimal::from(1)); // 1 SUI
        assert_eq!(mist_to_sui(100_000_000), BigDecimal::from_str("0.1").unwrap()); // 0.1 SUI
        assert_eq!(mist_to_sui(10_000_000), BigDecimal::from_str("0.01").unwrap()); // 0.01 SUI
    }

    #[test]
    fn test_sui_to_mist() {
        let one_sui = BigDecimal::from(1);
        assert_eq!(sui_to_mist(&one_sui).unwrap(), 1_000_000_000);

        let half_sui = BigDecimal::from_str("0.5").unwrap();
        assert_eq!(sui_to_mist(&half_sui).unwrap(), 500_000_000);
    }

    #[test]
    fn test_mist_sui_roundtrip() {
        let original_mist = 123_456_789u64;
        let sui = mist_to_sui(original_mist);
        let converted_back = sui_to_mist(&sui).unwrap();
        assert_eq!(original_mist, converted_back);
    }

    // BlobId tests
    #[test]
    fn test_blob_id_creation() {
        let bytes = [1u8; 32];
        let blob_id = BlobId::new(bytes);
        assert_eq!(blob_id.as_bytes(), &bytes);
    }

    #[test]
    fn test_blob_id_zero() {
        let zero = BlobId::ZERO;
        assert_eq!(zero.0, [0u8; 32]);
    }

    #[test]
    fn test_blob_id_hex_string() {
        let mut bytes = [0u8; 32];
        bytes[0] = 0xFF;
        bytes[31] = 0xAB;

        let blob_id = BlobId(bytes);
        let hex = blob_id.to_hex_string();

        assert!(hex.starts_with("0xff"));
        assert!(hex.ends_with("ab"));
    }

    #[test]
    fn test_blob_id_from_bytes() {
        let bytes = [42u8; 32];
        let blob_id: BlobId = bytes.into();
        assert_eq!(blob_id.0, bytes);
    }

    #[test]
    fn test_blob_id_to_bytes() {
        let blob_id = BlobId([99u8; 32]);
        let bytes: [u8; 32] = blob_id.into();
        assert_eq!(bytes, [99u8; 32]);
    }

    #[test]
    fn test_blob_id_serialize_roundtrip() {
        let original = BlobId([123u8; 32]);
        let bytes = bcs::to_bytes(&original).expect("Serialization failed");
        let deserialized: BlobId = bcs::from_bytes(&bytes).expect("Deserialization failed");
        assert_eq!(original, deserialized);
    }

    #[test]
    fn test_blob_id_equality() {
        let id1 = BlobId([1u8; 32]);
        let id2 = BlobId([1u8; 32]);
        let id3 = BlobId([2u8; 32]);

        assert_eq!(id1, id2);
        assert_ne!(id1, id3);
    }

    #[test]
    fn test_blob_id_ordering() {
        let id1 = BlobId([1u8; 32]);
        let id2 = BlobId([2u8; 32]);

        assert!(id1 < id2);
        assert!(id2 > id1);
    }

    #[test]
    fn test_blob_id_to_bigdecimal_zero() {
        let blob_id = BlobId::ZERO;
        let decimal = blob_id.to_bigdecimal().expect("Failed to convert");
        assert_eq!(decimal, BigDecimal::from(0));
    }

    #[test]
    fn test_blob_id_to_bigdecimal_small_value() {
        let mut bytes = [0u8; 32];
        bytes[0] = 42; // 42 in little-endian
        let blob_id = BlobId(bytes);

        let decimal = blob_id.to_bigdecimal().expect("Failed to convert");
        assert_eq!(decimal, BigDecimal::from(42));
    }

    #[test]
    fn test_blob_id_to_bigdecimal_large_value() {
        let bytes = [0xFF; 32]; // Max u256
        let blob_id = BlobId(bytes);

        let decimal = blob_id.to_bigdecimal().expect("Failed to convert");

        // Max u256 = 2^256 - 1
        let expected = BigDecimal::from_str(
            "115792089237316195423570985008687907853269984665640564039457584007913129639935"
        ).unwrap();

        assert_eq!(decimal, expected);
    }

    #[test]
    fn test_blob_id_to_bigdecimal_specific_value() {
        // Test with a specific known value: 256 (0x100)
        let mut bytes = [0u8; 32];
        bytes[0] = 0x00;
        bytes[1] = 0x01; // 256 in little-endian (0x0100)
        let blob_id = BlobId(bytes);

        let decimal = blob_id.to_bigdecimal().expect("Failed to convert");
        assert_eq!(decimal, BigDecimal::from(256));
    }

    #[test]
    fn test_blob_id_to_hex_string_format() {
        let mut bytes = [0u8; 32];
        bytes[0] = 0x12;
        bytes[1] = 0x34;
        bytes[31] = 0xAB;

        let blob_id = BlobId(bytes);
        let hex = blob_id.to_hex_string();

        // Should start with 0x
        assert!(hex.starts_with("0x"));

        // Should be 66 characters (0x + 64 hex digits)
        assert_eq!(hex.len(), 66);

        // Should contain our test bytes (little-endian display)
        assert!(hex.starts_with("0x1234"));
        assert!(hex.ends_with("ab"));
    }

    #[test]
    fn test_blob_id_display_trait() {
        let blob_id = BlobId([0xFF; 32]);
        let displayed = format!("{}", blob_id);

        // Display should match to_hex_string
        assert_eq!(displayed, blob_id.to_hex_string());

        // Should be proper hex format
        assert!(displayed.starts_with("0x"));
        assert_eq!(displayed.len(), 66);
    }

    #[test]
    fn test_blob_id_roundtrip_with_bigdecimal() {
        // Test that we can convert to BigDecimal and the value is correct
        let original_value = 123456789u64;
        let mut bytes = [0u8; 32];

        // Store value in little-endian
        bytes[0..8].copy_from_slice(&original_value.to_le_bytes());

        let blob_id = BlobId(bytes);
        let decimal = blob_id.to_bigdecimal().expect("Failed to convert");

        // Verify the decimal matches our original value
        assert_eq!(decimal, BigDecimal::from(original_value));
    }
}
