import { Router, type Request } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validation.js';
import { requirePermission, getDefaultPermissionsForRole } from '../middleware/permissions.js';
import { ApiError } from '../middleware/errorHandler.js';
import prisma from '../db.js';
import type { UserRole, DashboardPage, PermissionLevel } from '../generated/prisma/index.js';

/** Parse :id route param safely. */
function parseId(req: Request): number {
  return parseInt(String(req.params.id), 10);
}

const router = Router();

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const roleValues = ['super_admin', 'executive', 'manager', 'staff'] as const;

const dashboardPageValues = [
  'executive_summary',
  'financial_deep_dive',
  'pl_monthly_detail',
  'sales_pipeline',
  'marketing_leads',
  'operations_productivity',
  'regional_performance',
  'cash_position',
  'data_management',
  'target_management',
  'staff_management',
  'admin_settings',
  'user_permission_management',
] as const;

const permissionLevelValues = ['read', 'write', 'no_access'] as const;

const updateRoleSchema = z.object({
  role: z.enum(roleValues),
  applyDefaults: z.boolean().default(false),
});

const updatePermissionsSchema = z.object({
  permissions: z.array(
    z.object({
      page: z.enum(dashboardPageValues),
      permissionLevel: z.enum(permissionLevelValues),
    })
  ),
});

const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

const createUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(100),
  role: z.enum(roleValues).default('staff'),
});

// ─── GET / — List all users with permissions ─────────────────────────────────

router.get(
  '/',
  requirePermission('user_permission_management', 'read'),
  async (_req, res, next) => {
    try {
      const users = await prisma.user.findMany({
        include: { permissions: true },
        orderBy: { displayName: 'asc' },
      });
      res.json(users);
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /:id — Get single user with permissions ────────────────────────────

router.get(
  '/:id',
  requirePermission('user_permission_management', 'read'),
  async (req, res, next) => {
    try {
      const id = parseId(req);
      if (isNaN(id)) return next(ApiError.badRequest('Invalid user ID'));

      const user = await prisma.user.findUnique({
        where: { id },
        include: { permissions: true },
      });

      if (!user) return next(ApiError.notFound('User not found'));
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

// ─── PUT /:id/role — Update user role ────────────────────────────────────────

router.put(
  '/:id/role',
  requirePermission('user_permission_management', 'write'),
  validateBody(updateRoleSchema),
  async (req, res, next) => {
    try {
      const id = parseId(req);
      if (isNaN(id)) return next(ApiError.badRequest('Invalid user ID'));

      const { role, applyDefaults } = (req as any).validated as {
        role: UserRole;
        applyDefaults: boolean;
      };

      if (applyDefaults) {
        // Transaction: update role + replace all permissions with defaults
        const defaults = getDefaultPermissionsForRole(role);

        await prisma.$transaction([
          prisma.user.update({ where: { id }, data: { role } }),
          prisma.userPermission.deleteMany({ where: { userId: id } }),
          prisma.userPermission.createMany({
            data: defaults.map((d) => ({
              userId: id,
              page: d.page as DashboardPage,
              permissionLevel: d.permissionLevel as PermissionLevel,
            })),
          }),
        ]);
      } else {
        await prisma.user.update({ where: { id }, data: { role } });
      }

      const updated = await prisma.user.findUnique({
        where: { id },
        include: { permissions: true },
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ─── PUT /:id/permissions — Bulk update permissions ──────────────────────────

router.put(
  '/:id/permissions',
  requirePermission('user_permission_management', 'write'),
  validateBody(updatePermissionsSchema),
  async (req, res, next) => {
    try {
      const id = parseId(req);
      if (isNaN(id)) return next(ApiError.badRequest('Invalid user ID'));

      const { permissions } = (req as any).validated as {
        permissions: Array<{ page: DashboardPage; permissionLevel: PermissionLevel }>;
      };

      // Transaction: delete all existing, create new set
      await prisma.$transaction([
        prisma.userPermission.deleteMany({ where: { userId: id } }),
        prisma.userPermission.createMany({
          data: permissions.map((p) => ({
            userId: id,
            page: p.page,
            permissionLevel: p.permissionLevel,
          })),
        }),
      ]);

      const updated = await prisma.user.findUnique({
        where: { id },
        include: { permissions: true },
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ─── PUT /:id/status — Toggle active/inactive ───────────────────────────────

router.put(
  '/:id/status',
  requirePermission('user_permission_management', 'write'),
  validateBody(updateStatusSchema),
  async (req, res, next) => {
    try {
      const id = parseId(req);
      if (isNaN(id)) return next(ApiError.badRequest('Invalid user ID'));

      const { isActive } = (req as any).validated as { isActive: boolean };

      const updated = await prisma.user.update({
        where: { id },
        data: { isActive },
        include: { permissions: true },
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST / — Create user (dev mode only) ───────────────────────────────────

router.post(
  '/',
  requirePermission('user_permission_management', 'write'),
  validateBody(createUserSchema),
  async (req, res, next) => {
    try {
      if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({
          error: {
            message: 'User creation is only available in development mode',
            statusCode: 403,
          },
        });
      }

      const { email, displayName, role } = (req as any).validated as {
        email: string;
        displayName: string;
        role: UserRole;
      };

      // Check for existing user with same email
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({
          error: {
            message: 'A user with this email already exists',
            statusCode: 409,
          },
        });
      }

      // Create user and apply default permissions in a transaction
      const defaults = getDefaultPermissionsForRole(role);

      const user = await prisma.user.create({
        data: {
          email,
          displayName,
          role,
          isActive: true,
        },
      });

      await prisma.userPermission.createMany({
        data: defaults.map((d) => ({
          userId: user.id,
          page: d.page as DashboardPage,
          permissionLevel: d.permissionLevel as PermissionLevel,
        })),
      });

      const created = await prisma.user.findUnique({
        where: { id: user.id },
        include: { permissions: true },
      });

      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
