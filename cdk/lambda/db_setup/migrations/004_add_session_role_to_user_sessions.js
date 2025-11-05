exports.up = (pgm) => {
  pgm.sql(`
    CREATE TYPE session_role AS ENUM ('student', 'instructor');
    ALTER TABLE user_sessions ADD COLUMN role session_role NOT NULL DEFAULT 'student';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE user_sessions DROP COLUMN role;
    DROP TYPE IF EXISTS session_role;
  `);
};
