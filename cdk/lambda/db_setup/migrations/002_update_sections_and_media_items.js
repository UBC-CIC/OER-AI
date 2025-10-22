exports.up = (pgm) => {
  pgm.sql(`
    -- Update the sections table
    -- Add source_url column
    ALTER TABLE sections
    ADD COLUMN source_url varchar(512);

    -- Remove page_start and page_end columns from sections
    ALTER TABLE sections
    DROP COLUMN page_start,
    DROP COLUMN page_end;

    -- Update the media_items table
    -- Add source_url column
    ALTER TABLE media_items
    ADD COLUMN source_url varchar(512);

    -- Add section_id column
    ALTER TABLE media_items
    ADD COLUMN section_id uuid;

    -- Remove page_start and page_end columns from media_items
    ALTER TABLE media_items
    DROP COLUMN page_start,
    DROP COLUMN page_end;

    -- Add foreign key constraint for section_id in media_items
    ALTER TABLE media_items
    ADD CONSTRAINT fk_media_items_section_id 
    FOREIGN KEY (section_id) REFERENCES sections(id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    -- Revert changes to media_items table
    -- First, drop the foreign key constraint
    ALTER TABLE media_items
    DROP CONSTRAINT IF EXISTS fk_media_items_section_id;

    -- Remove source_url and section_id columns
    ALTER TABLE media_items
    DROP COLUMN IF EXISTS source_url,
    DROP COLUMN IF EXISTS section_id;

    -- Add back page_start and page_end columns
    ALTER TABLE media_items
    ADD COLUMN page_start int,
    ADD COLUMN page_end int;

    -- Revert changes to sections table
    -- Remove source_url column
    ALTER TABLE sections
    DROP COLUMN IF EXISTS source_url;

    -- Add back page_start and page_end columns
    ALTER TABLE sections
    ADD COLUMN page_start int,
    ADD COLUMN page_end int;
  `);
};
