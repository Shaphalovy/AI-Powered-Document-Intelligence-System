import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { DetectedFileType } from './file-type.detector';

export type DocumentStatus =
  | 'uploaded'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'needs_review'
  | 'failed';

// Named DocumentEntity to avoid a clash with the global DOM "Document" type.
@Entity({ name: 'documents' })
export class DocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @Column({ name: 'original_filename', type: 'varchar', length: 255 })
  originalFilename!: string;

  @Column({ name: 'stored_path', type: 'text' })
  storedPath!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType!: string;

  @Column({ name: 'file_type', type: 'varchar', length: 10 })
  fileType!: DetectedFileType;

  // PostgreSQL bigint comes back from the pg driver as a string.
  @Column({ name: 'file_size', type: 'bigint' })
  fileSize!: string;

  @Column({ type: 'char', length: 64 })
  sha256!: string;

  @Column({ name: 'page_count', type: 'int', nullable: true })
  pageCount!: number | null;

  @Column({ type: 'varchar', length: 20, default: 'uploaded' })
  status!: DocumentStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
