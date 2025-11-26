exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE user_sessions
    ADD COLUMN tokens_used BIGINT DEFAULT 0,
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE user_sessions
    DROP COLUMN tokens_used,
    DROP COLUMN updated_at;
  `);
};
