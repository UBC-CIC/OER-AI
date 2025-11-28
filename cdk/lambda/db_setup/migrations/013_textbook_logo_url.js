exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE textbooks
    ADD COLUMN textbook_logo_url VARCHAR(255);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE textbooks
    DROP COLUMN textbook_logo_url;
  `);
};
