exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE jobs (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      textbook_id uuid NOT NULL,
      status job_status NOT NULL DEFAULT 'pending',
      ingested_sections int DEFAULT 0,
      total_sections int DEFAULT 0,
      ingested_images int DEFAULT 0,
      ingested_videos int DEFAULT 0,
      error_message text,
      started_at timestamptz,
      completed_at timestamptz,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      metadata json DEFAULT '{}'
    );

    -- Add foreign key constraint
    ALTER TABLE jobs ADD CONSTRAINT fk_jobs_textbook_id FOREIGN KEY (textbook_id) REFERENCES textbooks(id) ON DELETE CASCADE;

    -- Create indexes for common queries
    CREATE INDEX idx_jobs_textbook_id ON jobs(textbook_id);
    CREATE INDEX idx_jobs_status ON jobs(status);
    CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS jobs CASCADE;
  `);
};
