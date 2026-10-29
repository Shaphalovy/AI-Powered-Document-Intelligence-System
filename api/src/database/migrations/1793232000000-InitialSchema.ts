import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1793232000000 implements MigrationInterface {
  name = 'InitialSchema1793232000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    await q.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email varchar(255) NOT NULL UNIQUE,
        password_hash text NOT NULL,
        role varchar(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
        created_at timestamptz NOT NULL DEFAULT now()
      )`);

    await q.query(`
      CREATE TABLE documents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        original_filename varchar(255) NOT NULL,
        stored_path text NOT NULL,
        mime_type varchar(100) NOT NULL,
        file_type varchar(10) NOT NULL CHECK (file_type IN ('pdf','jpg','png','tiff','xlsx','xls','csv')),
        file_size bigint NOT NULL CHECK (file_size > 0),
        sha256 char(64) NOT NULL,
        page_count int,
        status varchar(20) NOT NULL DEFAULT 'uploaded'
          CHECK (status IN ('uploaded','queued','processing','completed','needs_review','failed')),
        error_message text,
        attempts int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX idx_documents_owner ON documents (owner_id)`);
    await q.query(`CREATE INDEX idx_documents_status ON documents (status)`);
    await q.query(`CREATE INDEX idx_documents_sha256 ON documents (sha256)`);

    await q.query(`
      CREATE TABLE document_pages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        page_number int NOT NULL,
        label varchar(255),
        source varchar(10) NOT NULL CHECK (source IN ('text','ocr','sheet')),
        text_content text NOT NULL DEFAULT '',
        ocr_confidence numeric(5,2),
        UNIQUE (document_id, page_number)
      )`);

    await q.query(`
      CREATE TABLE invoices (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        page_start int,
        page_end int,
        invoice_number varchar(100),
        invoice_date date,
        supplier_name varchar(255),
        customer_name varchar(255),
        subtotal numeric(18,4),
        tax numeric(18,4),
        total numeric(18,4),
        currency char(3),
        field_confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
        raw_extraction jsonb,
        extraction_model varchar(100),
        review_status varchar(20) NOT NULL DEFAULT 'auto_ok'
          CHECK (review_status IN ('auto_ok','needs_review','corrected','approved')),
        duplicate_of uuid REFERENCES invoices(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX idx_invoices_document ON invoices (document_id)`);
    await q.query(`CREATE INDEX idx_invoices_dup ON invoices (supplier_name, invoice_number)`);
    await q.query(`CREATE INDEX idx_invoices_review ON invoices (review_status)`);

    await q.query(`
      CREATE TABLE invoice_line_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        position int NOT NULL,
        description text,
        quantity numeric(18,4),
        unit_price numeric(18,4),
        line_total numeric(18,4),
        UNIQUE (invoice_id, position)
      )`);

    await q.query(`
      CREATE TABLE validation_issues (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
        code varchar(50) NOT NULL,
        severity varchar(10) NOT NULL CHECK (severity IN ('error','warning')),
        field varchar(50),
        message text NOT NULL,
        details jsonb,
        resolved boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX idx_issues_document ON validation_issues (document_id)`);
    await q.query(`CREATE INDEX idx_issues_invoice ON validation_issues (invoice_id)`);

    await q.query(`
      CREATE TABLE corrections (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        field varchar(80) NOT NULL,
        old_value text,
        new_value text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX idx_corrections_invoice ON corrections (invoice_id)`);

    await q.query(`
      CREATE TABLE processing_events (
        id bigserial PRIMARY KEY,
        document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        stage varchar(30) NOT NULL,
        status varchar(20) NOT NULL CHECK (status IN ('started','succeeded','failed','retried')),
        message text,
        duration_ms int,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX idx_events_document ON processing_events (document_id)`);

    await q.query(`
      CREATE TABLE document_chunks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        page_number int NOT NULL,
        chunk_index int NOT NULL,
        content text NOT NULL,
        content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
        embedding vector(384),
        UNIQUE (document_id, page_number, chunk_index)
      )`);
    await q.query(`CREATE INDEX idx_chunks_tsv ON document_chunks USING gin (content_tsv)`);
    await q.query(
      `CREATE INDEX idx_chunks_embedding ON document_chunks USING hnsw (embedding vector_cosine_ops)`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS document_chunks`);
    await q.query(`DROP TABLE IF EXISTS processing_events`);
    await q.query(`DROP TABLE IF EXISTS corrections`);
    await q.query(`DROP TABLE IF EXISTS validation_issues`);
    await q.query(`DROP TABLE IF EXISTS invoice_line_items`);
    await q.query(`DROP TABLE IF EXISTS invoices`);
    await q.query(`DROP TABLE IF EXISTS document_pages`);
    await q.query(`DROP TABLE IF EXISTS documents`);
    await q.query(`DROP TABLE IF EXISTS users`);
  }
}