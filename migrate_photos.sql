ALTER TABLE photos
  ADD COLUMN original_filename text,
  ADD COLUMN file_path text,
  ADD COLUMN file_size integer;
  
UPDATE photos
  SET original_filename = filename,
      file_path = /tmp/placeholder,
      file_size = 0;
