import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

// WHATSAPP BULK EXPENSES — one ledger-style "Project Expense:" message parsed
// into many lines, held here (PENDING) until the sender replies YES. Nothing
// reaches the real expense table before that confirmation.
export type WhatsappExpenseBatchStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'SUPERSEDED';

export interface ExpenseBatchStoredLine {
  date: string;
  description: string;
  amount: number;
  quantity: number | null;
  unit: string | null;
  vendor: string;
  paid_by: string | null;
  trade_category: string;
  kind: string | null;
  raw_line: string;
}

@Entity({ name: 'whatsapp_expense_batches', schema: 'data_acquisition' })
@Index(['project_ref', 'status'])
export class WhatsappExpenseBatchEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  inbound_message_id: string;

  @Column({ type: 'uuid' })
  project_ref: string;

  @Column({ type: 'varchar', length: 12, default: 'PENDING' })
  status: WhatsappExpenseBatchStatus;

  @Column({ type: 'jsonb' })
  lines: ExpenseBatchStoredLine[];

  @Column({ type: 'int' })
  line_count: number;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  total_amount: string;

  @Column({ type: 'jsonb', nullable: true })
  result: unknown | null;

  @Column({ type: 'jsonb', nullable: true })
  raw_ai_response: unknown | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  confirmed_at: Date | null;
}
