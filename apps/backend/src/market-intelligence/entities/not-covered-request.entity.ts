import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Index(['location_queried'])
@Entity({ name: 'not_covered_requests', schema: 'market_intelligence' })
export class NotCoveredRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  location_queried: string;

  @CreateDateColumn()
  requested_at: Date;

  // No User entity yet — same pattern as Property.owner_ref
  @Column({ type: 'uuid', nullable: true })
  requested_by: string | null;
}
