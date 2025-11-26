exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE textbooks
    ADD COLUMN status VARCHAR(50) DEFAULT 'Disabled' NOT NULL CHECK (status IN ('Active', 'Disabled', 'Ingesting'));
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE textbooks
    DROP COLUMN status;
  `);
};
