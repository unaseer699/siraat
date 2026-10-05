import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappListingForwarderEntity } from './entities/whatsapp-listing-forwarder.entity';

// WHATSAPP LISTING INGESTION — thin CRUD, same shape as
// WhatsappService.createMapping/listMappings/deleteMapping for
// WhatsappProjectMappingEntity, kept on its own service rather than folded
// into WhatsappService (which already juggles webhook receipt + expense
// mapping) so the "which number routes to listings" concern stays separable
// and separately testable, matching the existing WhatsappService/
// WhatsappParsingService/WhatsappBusinessLinkService split.
export interface CreateListingForwarderInput {
  wa_id: string;
  label: string;
  created_by: string;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

@Injectable()
export class WhatsappListingForwarderService {
  constructor(
    @InjectRepository(WhatsappListingForwarderEntity)
    private readonly forwarderRepo: Repository<WhatsappListingForwarderEntity>,
  ) {}

  // Checked by WhatsappService.processInboundMessage on every inbound
  // message to decide routing — a plain findOneBy, not a cached allowlist,
  // since forwarder numbers are few and added rarely; no cache invalidation
  // to get wrong.
  async isForwarder(waId: string): Promise<boolean> {
    const existing = await this.forwarderRepo.findOneBy({ wa_id: waId });
    return existing !== null;
  }

  async createForwarder(data: CreateListingForwarderInput): Promise<WhatsappListingForwarderEntity> {
    const existing = await this.forwarderRepo.findOneBy({ wa_id: data.wa_id });
    if (existing) {
      throw new ConflictException({
        error_code: 'DUPLICATE_FORWARDER',
        message: 'This WhatsApp number is already registered as a listing forwarder',
      });
    }

    const forwarder = this.forwarderRepo.create(data);
    try {
      return await this.forwarderRepo.save(forwarder);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException({
          error_code: 'DUPLICATE_FORWARDER',
          message: 'This WhatsApp number is already registered as a listing forwarder',
        });
      }
      throw err;
    }
  }

  async listForwarders(): Promise<WhatsappListingForwarderEntity[]> {
    return this.forwarderRepo.find({ order: { created_at: 'DESC' } });
  }

  async deleteForwarder(id: string): Promise<void> {
    const result = await this.forwarderRepo.delete({ id });
    if (!result.affected) {
      throw new NotFoundException(`Listing forwarder ${id} not found`);
    }
  }
}
