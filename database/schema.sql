
CREATE TABLE IF NOT EXISTS users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(50) NOT NULL
        CHECK (char_length(trim(name)) >= 2),
    email VARCHAR(255) NOT NULL UNIQUE
        CHECK (email = lower(email)),
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type VARCHAR(10) NOT NULL
        CHECK (type IN ('private', 'group')),
    title VARCHAR(80),
    created_by BIGINT NOT NULL
        REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        (type = 'private' AND title IS NULL)
        OR
        (type = 'group' AND title IS NOT NULL
         AND char_length(trim(title)) >= 1)
    )
);

CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id BIGINT NOT NULL
        REFERENCES conversations(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id BIGINT NOT NULL
        REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id BIGINT NOT NULL
        REFERENCES users(id),
    text VARCHAR(5000) NOT NULL
        CHECK (char_length(trim(text)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_participants_user
ON conversation_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
ON messages(conversation_id, created_at, id);

CREATE INDEX IF NOT EXISTS idx_conversations_updated
ON conversations(updated_at DESC);
