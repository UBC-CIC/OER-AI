exports.up = (pgm) => {
  pgm.sql(`
    ALTER TYPE prompt_type ADD VALUE 'guided';
    
    CREATE TABLE guided_prompt_questions (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      prompt_template_id uuid NOT NULL,
      question_text text NOT NULL,
      order_index int NOT NULL,
      created_at timestamptz DEFAULT now(),
      FOREIGN KEY (prompt_template_id) REFERENCES prompt_templates(id) ON DELETE CASCADE
    );
    
    CREATE INDEX idx_guided_questions_template ON guided_prompt_questions(prompt_template_id, order_index);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS guided_prompt_questions CASCADE;`);
};