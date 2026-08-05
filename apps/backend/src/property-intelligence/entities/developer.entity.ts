import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity({ name: 'developers', schema: 'property_intelligence' })
export class DeveloperEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  // Free-text project names — formal Project entity is a future phase concern
  @Column({ type: 'text', array: true, default: '{}' })
  project_history: string[];

  @Column({ type: 'boolean', default: false })
  is_siraat_affiliated: boolean;

  @CreateDateColumn()
  created_at: Date;
}
