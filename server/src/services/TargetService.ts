import prisma from '../db.js';
import type { TargetType, Region } from '../generated/prisma/index.js';

export class TargetService {
  /**
   * Resolves the active target for a given type/entity at a specific week.
   * Returns the target with the most recent effective_from <= weekEnding.
   */
  static async getTargetForWeek(
    targetType: TargetType,
    weekEnding: Date,
    entity?: Region | null
  ) {
    return prisma.target.findFirst({
      where: {
        targetType,
        entity: entity ?? null,
        effectiveFrom: { lte: weekEnding },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: weekEnding } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  /**
   * Returns all current targets for a given week (most recent effective_from <= weekEnding per type/entity).
   */
  static async getAllTargetsForWeek(weekEnding: Date) {
    const targets = await prisma.target.findMany({
      where: {
        effectiveFrom: { lte: weekEnding },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: weekEnding } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    // Deduplicate: keep most recent per targetType + entity combination
    const seen = new Map<string, typeof targets[0]>();
    for (const t of targets) {
      const key = `${t.targetType}:${t.entity ?? ''}`;
      if (!seen.has(key)) {
        seen.set(key, t);
      }
    }
    return Array.from(seen.values());
  }

  /**
   * Creates a new target, closing the previous one's effective_to date.
   */
  static async createTarget(data: {
    targetType: TargetType;
    entity?: Region | null;
    amount: number;
    effectiveFrom: Date;
    setBy?: string;
    notes?: string;
  }) {
    // Find the currently active target of same type/entity
    const previous = await prisma.target.findFirst({
      where: {
        targetType: data.targetType,
        entity: data.entity ?? null,
        effectiveTo: null,
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    return prisma.$transaction(async (tx) => {
      // Close previous target
      if (previous) {
        const effectiveTo = new Date(data.effectiveFrom);
        effectiveTo.setUTCDate(effectiveTo.getUTCDate() - 1);

        await tx.target.update({
          where: { id: previous.id },
          data: { effectiveTo },
        });

        // Record history
        await tx.targetHistory.create({
          data: {
            targetId: previous.id,
            previousAmount: previous.amount,
            newAmount: data.amount,
            changedBy: data.setBy,
            notes: data.notes,
          },
        });
      }

      // Create new target
      return tx.target.create({
        data: {
          targetType: data.targetType,
          entity: data.entity ?? null,
          amount: data.amount,
          effectiveFrom: data.effectiveFrom,
          setBy: data.setBy,
          notes: data.notes,
        },
      });
    });
  }

  /**
   * Updates an existing target by superseding it with a new effective_from.
   */
  static async updateTarget(
    id: number,
    data: { amount: number; effectiveFrom: Date; setBy?: string; notes?: string }
  ) {
    const existing = await prisma.target.findUnique({ where: { id } });
    if (!existing) return null;

    return this.createTarget({
      targetType: existing.targetType,
      entity: existing.entity,
      amount: data.amount,
      effectiveFrom: data.effectiveFrom,
      setBy: data.setBy,
      notes: data.notes,
    });
  }

  /**
   * Returns full change history for a target type (optionally filtered by entity).
   */
  static async getHistory(targetType: TargetType, entity?: Region | null) {
    const targets = await prisma.target.findMany({
      where: {
        targetType,
        ...(entity !== undefined ? { entity: entity ?? null } : {}),
      },
      include: { history: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    return targets;
  }
}
