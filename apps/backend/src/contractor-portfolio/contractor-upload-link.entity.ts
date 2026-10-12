import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

// A private upload link a contractor uses to send their own project photos.
// Only the SHA-256 of the token is stored; the raw token is shown to the admin
// once, when generated. Generating a new link revokes the old one.
@Entity({ name: 'contractor_upload_links', schema: 'property_intelligence' })
export class ContractorUploadLinkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  contractor_id: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  token_hash: string;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revoked_at: Date | null;
}
