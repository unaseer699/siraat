import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export type WhatsappPlan = 'TRIAL' | 'PAID' | 'BLOCKED';

// Self-serve "Live construction project" subscription, one row per WhatsApp
// number. Operational config (not a FACT/GENERATED record), `data_acquisition`
// schema. TRIAL = limited saved expenses; PAID = unlimited until paid_until.
@Entity({ name: 'whatsapp_accounts', schema: 'data_acquisition' })
export class WhatsappAccountEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  wa_id: string;

  @Column({ type: 'varchar', length: 10, default: 'TRIAL' })
  plan: WhatsappPlan;

  @Column({ type: 'int', default: 25 })
  trial_expense_limit: number;

  @Column({ type: 'timestamptz', nullable: true })
  paid_until: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
