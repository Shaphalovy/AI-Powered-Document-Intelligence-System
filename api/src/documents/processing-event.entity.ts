import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type ProcessingEventStatus =
  | 'started'
  | 'succeeded'
  | 'failed'
  | 'retried';

@Entity({ name: 'processing_events' })
export class ProcessingEventEntity {
  // PostgreSQL bigint comes back from the pg driver as a string.
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId!: string;

  @Column({ type: 'varchar', length: 30 })
  stage!: string;

  @Column({ type: 'varchar', length: 20 })
  status!: ProcessingEventStatus;

  @Column({ type: 'text', nullable: true })
  message!: string | null;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
