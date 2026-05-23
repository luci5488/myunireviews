ALTER TABLE institutions ADD COLUMN IF NOT EXISTS email_domain VARCHAR(100);

UPDATE institutions SET email_domain = 'uni.sydney.edu.au' WHERE short_name = 'USYD';
