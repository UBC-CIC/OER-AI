exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE shared_user_prompts
    ADD COLUMN reported boolean DEFAULT false;
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE shared_user_prompts
    DROP COLUMN IF EXISTS reported;
  `);
};
