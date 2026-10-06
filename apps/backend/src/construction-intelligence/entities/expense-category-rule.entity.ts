import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

// Learned mapping from an expense description to its section and kind. Rows
// come from the founder's own rules and from every expense moved between
// sections. Configuration, not a FACT record.
@Entity({ name: 'expense_category_rules', schema: 'construction_intelligence' })
export class ExpenseCategoryRuleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 200 })
  pattern: string;

  @Column({ type: 'varchar', length: 30 })
  category: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  kind: string | null;

  @CreateDateColumn()
  created_at: Date;
}
