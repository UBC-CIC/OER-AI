exports.up = async (pgm) => {
  pgm.sql(`
      ALTER TABLE faq_cache
      ADD COLUMN sources json DEFAULT '[]';
    `);
};
