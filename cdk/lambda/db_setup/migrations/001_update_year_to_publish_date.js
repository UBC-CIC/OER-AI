exports.up = (pgm) => {
  pgm.sql(`
    -- Add the new publish_date column
    ALTER TABLE textbooks
    ADD COLUMN publish_date DATE;
    
    -- Drop the old year column
    ALTER TABLE textbooks
    DROP COLUMN year;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    -- Add back the year column
    ALTER TABLE textbooks
    ADD COLUMN year int;
    
    -- Drop the publish_date column
    ALTER TABLE textbooks
    DROP COLUMN publish_date;
  `);
};
