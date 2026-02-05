import prisma from '../db.js';
import type { RowValidation } from './CsvParserService.js';
import type { DataTypeDefinition } from './DataTypeRegistry.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DuplicateStrategy = 'overwrite' | 'skip' | 'merge';

export interface ImportRequest {
  dataType: DataTypeDefinition;
  fileName: string;
  mappingId?: number;
  rows: RowValidation[];
  duplicateStrategy: DuplicateStrategy;
  uploadedBy?: string;
}

export interface ImportResult {
  uploadId: number;
  status: 'completed' | 'failed';
  rowsProcessed: number;
  rowsFailed: number;
  rowsSkipped: number;
  rowsInserted: number;
  rowsUpdated: number;
  errors: RowError[];
}

interface RowError {
  rowIndex: number;
  messages: string[];
  original?: Record<string, string>;
}

interface RollbackData {
  targetTable: string;
  insertedIds: number[];
  overwritten: OverwrittenRecord[];
}

interface OverwrittenRecord {
  id: number;
  previousData: Record<string, any>;
}

// ─── Table Configuration ──────────────────────────────────────────────────────

/** Unique key fields for each table (used to detect existing records). */
const TABLE_UNIQUE_KEYS: Record<string, string[]> = {
  financial_weekly: ['weekEnding'],
  revenue_weekly: ['weekEnding', 'category'],
  projects_weekly: ['weekEnding', 'projectType'],
  sales_weekly: ['weekEnding', 'salesType'],
  sales_regional_weekly: ['weekEnding', 'region', 'salesType'],
  team_performance_weekly: ['weekEnding', 'region'],
  leads_weekly: ['weekEnding', 'source'],
  marketing_performance_weekly: ['weekEnding', 'platform'],
  website_analytics_weekly: ['weekEnding'],
  staff_productivity_weekly: ['weekEnding', 'staffName'],
  phone_weekly: ['weekEnding', 'staffName'],
  cash_position_weekly: ['weekEnding'],
  google_reviews_weekly: ['weekEnding'],
};

/** Convert snake_case table name to camelCase Prisma model accessor. */
function toPrismaModel(tableName: string): string {
  return tableName.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Build the unique where clause for a row in a given table.
 * Uses the table's unique key fields extracted from the row data.
 */
function buildUniqueWhere(tableName: string, data: Record<string, any>): Record<string, any> {
  const keys = TABLE_UNIQUE_KEYS[tableName];
  if (!keys) throw new Error(`Unknown table: ${tableName}`);

  const where: Record<string, any> = {};
  for (const key of keys) {
    if (data[key] === undefined || data[key] === null) {
      throw new Error(`Missing unique key field "${key}" for table "${tableName}"`);
    }
    where[key] = data[key];
  }
  return where;
}

/**
 * Strip Prisma-managed fields from data before insert/update.
 */
function stripManagedFields(data: Record<string, any>): Record<string, any> {
  const { id, createdAt, updatedAt, upload, ...rest } = data;
  return rest;
}

// ─── Import Engine ────────────────────────────────────────────────────────────

export async function importRows(request: ImportRequest): Promise<ImportResult> {
  const { dataType, fileName, mappingId, rows, duplicateStrategy, uploadedBy } = request;
  const tableName = dataType.targetTable;
  const modelName = toPrismaModel(tableName);
  const model = (prisma as any)[modelName];

  if (!model) throw new Error(`Prisma model not found for table: ${tableName}`);
  if (!TABLE_UNIQUE_KEYS[tableName]) throw new Error(`No unique key config for table: ${tableName}`);

  // Separate processable rows from failed rows
  const processable = rows.filter((r) => r.status !== 'error');
  const failed = rows.filter((r) => r.status === 'error');

  const errors: RowError[] = failed.map((r) => ({
    rowIndex: r.rowIndex,
    messages: r.messages,
    original: r.original,
  }));

  // Create the upload record first (outside transaction, so we have an ID)
  const uploadRecord = await prisma.csvUpload.create({
    data: {
      fileName,
      dataType: dataType.id,
      mappingId: mappingId ?? null,
      status: 'processing',
      uploadedBy: uploadedBy ?? null,
      rowsProcessed: 0,
      rowsFailed: failed.length,
      rowsSkipped: 0,
    },
  });

  const insertedIds: number[] = [];
  const overwritten: OverwrittenRecord[] = [];
  let rowsInserted = 0;
  let rowsUpdated = 0;
  let rowsSkipped = 0;

  try {
    // Process rows inside an interactive transaction
    await prisma.$transaction(async (tx: any) => {
      const txModel = tx[modelName];

      for (const row of processable) {
        try {
          const data = { ...row.data };

          // Build unique where clause
          const where = buildUniqueWhere(tableName, data);

          // Check for existing record
          const existing = await txModel.findFirst({ where });

          if (existing) {
            switch (duplicateStrategy) {
              case 'skip': {
                rowsSkipped++;
                break;
              }

              case 'overwrite': {
                // Store pre-update state for rollback
                overwritten.push({
                  id: existing.id,
                  previousData: stripManagedFields(existing),
                });

                // Update with new data + uploadId
                await txModel.update({
                  where: { id: existing.id },
                  data: {
                    ...stripManagedFields(data),
                    dataSource: 'csv_upload',
                    uploadId: uploadRecord.id,
                  },
                });
                rowsUpdated++;
                break;
              }

              case 'merge': {
                // Store pre-update state for rollback
                overwritten.push({
                  id: existing.id,
                  previousData: stripManagedFields(existing),
                });

                // Only update non-null fields from the new data
                const mergeData: Record<string, any> = {};
                for (const [key, value] of Object.entries(data)) {
                  if (value !== null && value !== undefined) {
                    mergeData[key] = value;
                  }
                }

                await txModel.update({
                  where: { id: existing.id },
                  data: {
                    ...mergeData,
                    dataSource: 'csv_upload',
                    uploadId: uploadRecord.id,
                  },
                });
                rowsUpdated++;
                break;
              }
            }
          } else {
            // Insert new row
            const created = await txModel.create({
              data: {
                ...stripManagedFields(data),
                dataSource: 'csv_upload',
                uploadId: uploadRecord.id,
              },
            });
            insertedIds.push(created.id);
            rowsInserted++;
          }
        } catch (rowErr: any) {
          // Row-level error — log and continue
          errors.push({
            rowIndex: row.rowIndex,
            messages: [`Import error: ${rowErr.message}`],
            original: row.original,
          });
        }
      }
    }, { timeout: 60_000 }); // 60s timeout for large imports

    // Store rollback data and update upload record
    const rollbackData: RollbackData = {
      targetTable: tableName,
      insertedIds,
      overwritten,
    };

    const finalRowsFailed = errors.length;

    await prisma.csvUpload.update({
      where: { id: uploadRecord.id },
      data: {
        status: 'completed',
        rowsProcessed: rowsInserted + rowsUpdated,
        rowsFailed: finalRowsFailed,
        rowsSkipped: rowsSkipped,
        rollbackData: rollbackData as any,
        errorLog: errors.length > 0 ? (errors as any) : null,
      },
    });

    return {
      uploadId: uploadRecord.id,
      status: 'completed',
      rowsProcessed: rowsInserted + rowsUpdated,
      rowsFailed: finalRowsFailed,
      rowsSkipped,
      rowsInserted,
      rowsUpdated,
      errors,
    };
  } catch (err: any) {
    // Transaction-level failure — mark upload as failed
    await prisma.csvUpload.update({
      where: { id: uploadRecord.id },
      data: {
        status: 'failed',
        errorLog: [{ message: err.message, stack: err.stack }] as any,
      },
    });

    return {
      uploadId: uploadRecord.id,
      status: 'failed',
      rowsProcessed: 0,
      rowsFailed: rows.length,
      rowsSkipped: 0,
      rowsInserted: 0,
      rowsUpdated: 0,
      errors: [{ rowIndex: 0, messages: [`Transaction failed: ${err.message}`] }],
    };
  }
}

// ─── Rollback Engine ──────────────────────────────────────────────────────────

export interface RollbackResult {
  uploadId: number;
  rowsDeleted: number;
  rowsRestored: number;
}

export async function rollbackUpload(uploadId: number): Promise<RollbackResult> {
  const upload = await prisma.csvUpload.findUnique({ where: { id: uploadId } });
  if (!upload) throw new Error('Upload not found');

  if (upload.status === 'rolled_back') {
    throw new Error('Upload has already been rolled back');
  }

  if (upload.status !== 'completed') {
    throw new Error(`Cannot rollback upload with status "${upload.status}". Only completed uploads can be rolled back.`);
  }

  const rollback = upload.rollbackData as unknown as RollbackData | null;
  if (!rollback || !rollback.targetTable) {
    throw new Error('No rollback data available for this upload');
  }

  const { targetTable, insertedIds, overwritten } = rollback;
  const modelName = toPrismaModel(targetTable);
  const model = (prisma as any)[modelName];

  if (!model) throw new Error(`Prisma model not found for table: ${targetTable}`);

  let rowsDeleted = 0;
  let rowsRestored = 0;

  await prisma.$transaction(async (tx: any) => {
    const txModel = tx[modelName];

    // 1. Delete all rows that were inserted by this upload
    if (insertedIds.length > 0) {
      const deleteResult = await txModel.deleteMany({
        where: { id: { in: insertedIds } },
      });
      rowsDeleted = deleteResult.count;
    }

    // 2. Restore overwritten rows to their previous state
    for (const record of overwritten) {
      // Remove the uploadId link and restore previous data
      const restoreData = { ...record.previousData };
      // Ensure we don't set id through the update data
      delete restoreData.id;

      await txModel.update({
        where: { id: record.id },
        data: restoreData,
      });
      rowsRestored++;
    }

    // 3. Update upload status
    await tx.csvUpload.update({
      where: { id: uploadId },
      data: { status: 'rolled_back' },
    });
  }, { timeout: 60_000 });

  return { uploadId, rowsDeleted, rowsRestored };
}
