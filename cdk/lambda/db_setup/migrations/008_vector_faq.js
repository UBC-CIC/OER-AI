exports.up = async (pgm) => {
  pgm.sql(`
      ALTER TABLE faq_cache 
      DROP COLUMN normalized_question;

      ALTER TABLE faq_cache
      ADD COLUMN embedding vector;

      ALTER TABLE faq_cache
      ADD COLUMN reported boolean DEFAULT false;
    `);
};
