// @generated automatically by Diesel CLI.

diesel::table! {
    meeting_rooms (id) {
        id -> Int8,
        #[max_length = 66]
        room_id -> Varchar,
        title -> Text,
        hosts -> Array<Varchar>,
        #[max_length = 66]
        seal_policy_id -> Varchar,
        status -> Int2,
        max_participants -> Int8,
        require_approval -> Bool,
        participant_count -> Int4,
        created_at -> Int8,
        started_at -> Nullable<Int8>,
        ended_at -> Nullable<Int8>,
        checkpoint_sequence_number -> Int8,
        #[max_length = 64]
        transaction_digest -> Varchar,
        indexed_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    room_participants (id) {
        id -> Int8,
        #[max_length = 66]
        room_id -> Varchar,
        #[max_length = 66]
        participant_address -> Varchar,
        #[max_length = 20]
        role -> Varchar,
        #[max_length = 66]
        admin_cap_id -> Nullable<Varchar>,
        joined_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    room_metadata (id) {
        id -> Int8,
        #[max_length = 66]
        room_id -> Varchar,
        #[max_length = 66]
        dynamic_field_id -> Varchar,
        df_version -> Int8,
        language -> Text,
        timezone -> Text,
        recording_blob_id -> Nullable<Numeric>,
        indexed_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::allow_tables_to_appear_in_same_query!(
    meeting_rooms,
    room_participants,
    room_metadata,
);
