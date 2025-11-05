exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE shared_user_prompts 
    ADD COLUMN role VARCHAR(20);
  `);
  
  // Optionally backfill existing rows with current role from user_sessions if needed
  pgm.sql(`
    UPDATE shared_user_prompts sup
    SET role = us.role
    FROM user_sessions us
    WHERE sup.owner_session_id = us.id
    AND sup.role IS NULL;
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE shared_user_prompts 
    DROP COLUMN IF EXISTS role;
  `);
};
