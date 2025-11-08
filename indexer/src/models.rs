use move_binding_derive::move_contract;
use crate::models::sui::vec_map::VecMap;
use std::collections::HashMap;
use std::hash::Hash;
move_contract! {alias = "move_lib", package = "0x1", base_path = crate::models}
move_contract! {alias="sui", package="0x2", base_path = crate::models}
// move_contract! {alias="sui_system", package="0x3", base_path = crate::models}
move_contract! {alias="wal", package="0x8270feb7375eee355e64fdb69c50abb6b5f9393a722883c1cf45f8e26048810a", network = "testnet", base_path = crate::models}
move_contract! {alias = "walrus", package = "0xd84704c17fc870b8764832c535aa6b11f21a95cd6f5bb38a9b07d2cf42220c66", network = "testnet", base_path = crate::models}
move_contract! {alias="sealmeet", package="0xc90c891397b21b051bd8f538f3b7daa087d185941aceb7b0dcd7b5c7a67be48f", network = "testnet", base_path = crate::models}

impl<K: Eq + Hash, V> From<VecMap<K, V>> for HashMap<K, V> {
    fn from(value: VecMap<K, V>) -> Self {
        value
            .contents
            .into_iter()
            .map(|entry| (entry.key, entry.value))
            .collect::<HashMap<K, V>>()
    }
}