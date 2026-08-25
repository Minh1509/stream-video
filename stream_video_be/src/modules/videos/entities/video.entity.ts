import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum VideoStatus {
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
}

@Entity({ name: 'videos' })
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'text', name: 'thumbnail_url', default: '' })
  thumbnailUrl: string;

  @Column({ type: 'text', name: 'hls_master_url', default: '' })
  hlsMasterUrl: string;

  @Column({
    type: 'enum',
    enum: VideoStatus,
    default: VideoStatus.PROCESSING,
  })
  status: VideoStatus;

  @Column({ type: 'int', default: 0 })
  duration: number;

  @Column({ type: 'text', name: 'source_filename', default: '' })
  sourceFilename: string;

  @Column({ type: 'varchar', length: 32, name: 'encryption_key', nullable: true })
  encryptionKey: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
