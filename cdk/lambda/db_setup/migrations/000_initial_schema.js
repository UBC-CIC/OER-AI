exports.up = (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "vector";

    -- Create enums
    CREATE TYPE user_role AS ENUM ('student', 'instructor', 'admin');
    CREATE TYPE prompt_type AS ENUM ('RAG', 'quiz_generation', 'mcq_generation', 'audio_generation');
    CREATE TYPE media_type AS ENUM ('pdf', 'audio', 'video', 'image', 'transcript', 'h5p', 'other');
    CREATE TYPE difficulty AS ENUM ('introductory', 'intermediate', 'advanced');
    CREATE TYPE visibility AS ENUM ('private', 'org', 'public');
    CREATE TYPE sender_role AS ENUM ('AI', 'User');
    CREATE TYPE job_type AS ENUM ('ingest_textbook', 'embed_chunks', 'transcribe', 'reindex', 'generate_questions');
    CREATE TYPE job_status AS ENUM ('pending', 'running', 'failed', 'done', 'canceled');

    -- Create tables
    CREATE TABLE users (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      display_name varchar(255),
      email varchar(255) UNIQUE,
      role user_role NOT NULL DEFAULT 'admin',
      institution_id varchar(255),
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      metadata json DEFAULT '{}'
    );

    CREATE TABLE textbooks (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      title varchar(255) NOT NULL,
      authors varchar[],
      license varchar(255),
      source_url varchar(512),
      publisher varchar(255),
      year int,
      summary text,
      language varchar(64),
      level varchar(64),
      created_by uuid,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      metadata json DEFAULT '{}'
    );

    CREATE TABLE media_items (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      textbook_id uuid,
      media_type media_type NOT NULL,
      uri varchar(512) NOT NULL,
      size_bytes bigint,
      mime_type varchar(128),
      description text,
      page_start int,
      page_end int,
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE sections (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      textbook_id uuid,
      parent_section_id uuid,
      title varchar(255),
      order_index int,
      page_start int,
      page_end int,
      summary text,
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE document_chunks (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      textbook_id uuid,
      section_id uuid,
      media_item_id uuid,
      chunk_text text NOT NULL,
      chunk_meta json DEFAULT '{}',
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE embeddings (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      chunk_id uuid,
      model varchar(255),
      vector vector NOT NULL,
      stored_vector_text text,
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE prompt_templates (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      name varchar(255) NOT NULL,
      description text,
      type prompt_type NOT NULL,
      current_version_id int,
      created_by uuid,
      visibility visibility NOT NULL DEFAULT 'private',
      metadata json DEFAULT '{}',
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    CREATE TABLE shared_user_prompts (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      title varchar(255),
      prompt_text text NOT NULL,
      owner_session_id uuid,
      owner_user_id uuid,
      textbook_id uuid,
      visibility visibility NOT NULL DEFAULT 'public',
      tags varchar[],
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      metadata json DEFAULT '{}'
    );

    CREATE TABLE user_sessions (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      session_id uuid NOT NULL,
      session_title varchar(255),
      context json DEFAULT '{}',
      created_at timestamptz DEFAULT now(),
      last_active_at timestamptz DEFAULT now(),
      expires_at timestamptz,
      metadata json DEFAULT '{}'
    );

    CREATE TABLE chat_sessions (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_sessions_session_id uuid NOT NULL,
      textbook_id uuid,
      context json DEFAULT '{}',
      created_at timestamptz DEFAULT now(),
      metadata json DEFAULT '{}'
    );

    CREATE TABLE user_interactions (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      session_id uuid,
      sender_role sender_role NOT NULL,
      query_text text,
      response_text text,
      message_meta json DEFAULT '{}',
      source_chunks json DEFAULT '[]',
      created_at timestamptz DEFAULT now(),
      order_index int
    );

    CREATE TABLE faq_cache (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      textbook_id uuid,
      question_text text NOT NULL,
      answer_text text NOT NULL,
      normalized_question varchar(512) NOT NULL,
      usage_count bigint DEFAULT 0,
      last_used_at timestamptz DEFAULT now(),
      cached_at timestamptz DEFAULT now(),
      metadata json DEFAULT '{}'
    );

    CREATE TABLE analytics_events (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_session_id uuid,
      event_type varchar(128) NOT NULL,
      properties json DEFAULT '{}',
      created_at timestamptz DEFAULT now()
    );

    -- Create indexes
    CREATE INDEX idx_user_interactions_session_id ON user_interactions(session_id);
    CREATE INDEX idx_faq_cache_normalized_question ON faq_cache(normalized_question);
    CREATE INDEX idx_analytics_events_user_session_id ON analytics_events(user_session_id);

    -- Add foreign key constraints
    ALTER TABLE textbooks ADD CONSTRAINT fk_textbooks_created_by FOREIGN KEY (created_by) REFERENCES users(id);
    ALTER TABLE media_items ADD CONSTRAINT fk_media_items_textbook_id FOREIGN KEY (textbook_id) REFERENCES textbooks(id);
    ALTER TABLE sections ADD CONSTRAINT fk_sections_textbook_id FOREIGN KEY (textbook_id) REFERENCES textbooks(id);
    ALTER TABLE sections ADD CONSTRAINT fk_sections_parent_section_id FOREIGN KEY (parent_section_id) REFERENCES sections(id);
    ALTER TABLE document_chunks ADD CONSTRAINT fk_document_chunks_textbook_id FOREIGN KEY (textbook_id) REFERENCES textbooks(id);
    ALTER TABLE document_chunks ADD CONSTRAINT fk_document_chunks_section_id FOREIGN KEY (section_id) REFERENCES sections(id);
    ALTER TABLE document_chunks ADD CONSTRAINT fk_document_chunks_media_item_id FOREIGN KEY (media_item_id) REFERENCES media_items(id);
    ALTER TABLE embeddings ADD CONSTRAINT fk_embeddings_chunk_id FOREIGN KEY (chunk_id) REFERENCES document_chunks(id);
    ALTER TABLE prompt_templates ADD CONSTRAINT fk_prompt_templates_created_by FOREIGN KEY (created_by) REFERENCES users(id);
    ALTER TABLE shared_user_prompts ADD CONSTRAINT fk_shared_user_prompts_owner_session_id FOREIGN KEY (owner_session_id) REFERENCES user_sessions(id);
    ALTER TABLE shared_user_prompts ADD CONSTRAINT fk_shared_user_prompts_owner_user_id FOREIGN KEY (owner_user_id) REFERENCES users(id);
    ALTER TABLE chat_sessions ADD CONSTRAINT fk_chat_sessions_user_sessions_session_id FOREIGN KEY (user_sessions_session_id) REFERENCES user_sessions(id);
    ALTER TABLE chat_sessions ADD CONSTRAINT fk_chat_sessions_textbook_id FOREIGN KEY (textbook_id) REFERENCES textbooks(id);
    ALTER TABLE user_interactions ADD CONSTRAINT fk_user_interactions_session_id FOREIGN KEY (session_id) REFERENCES user_sessions(id);
    ALTER TABLE faq_cache ADD CONSTRAINT fk_faq_cache_textbook_id FOREIGN KEY (textbook_id) REFERENCES textbooks(id);
    ALTER TABLE analytics_events ADD CONSTRAINT fk_analytics_events_user_session_id FOREIGN KEY (user_session_id) REFERENCES user_sessions(id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS analytics_events CASCADE;
    DROP TABLE IF EXISTS faq_cache CASCADE;
    DROP TABLE IF EXISTS user_interactions CASCADE;
    DROP TABLE IF EXISTS chat_sessions CASCADE;
    DROP TABLE IF EXISTS user_sessions CASCADE;
    DROP TABLE IF EXISTS shared_user_prompts CASCADE;
    DROP TABLE IF EXISTS prompt_templates CASCADE;
    DROP TABLE IF EXISTS embeddings CASCADE;
    DROP TABLE IF EXISTS document_chunks CASCADE;
    DROP TABLE IF EXISTS sections CASCADE;
    DROP TABLE IF EXISTS media_items CASCADE;
    DROP TABLE IF EXISTS textbooks CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    
    DROP TYPE IF EXISTS job_status;
    DROP TYPE IF EXISTS job_type;
    DROP TYPE IF EXISTS sender_role;
    DROP TYPE IF EXISTS visibility;
    DROP TYPE IF EXISTS difficulty;
    DROP TYPE IF EXISTS media_type;
    DROP TYPE IF EXISTS prompt_type;
    DROP TYPE IF EXISTS user_role;
  `);
};