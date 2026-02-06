import type { Request, Response, NextFunction } from 'express';
import type { DashboardPage, PermissionLevel, UserRole, UserPermission } from '../generated/prisma/index.js';
import prisma from '../db.js';

/**
 * All 13 DashboardPage values in canonical order.
 */
export const ALL_DASHBOARD_PAGES: DashboardPage[] = [
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
];

/**
 * Default permissions by role. Used when a user has no explicit
 * permission entry for a page.
 */
export const ROLE_DEFAULTS: Record<UserRole, PermissionLevel> = {
  super_admin: 'write',
  executive: 'read',
  manager: 'read',
  staff: 'no_access',
};

/**
 * Pages that staff can access by default (read-only).
 */
export const STAFF_READABLE_PAGES: DashboardPage[] = [
  'executive_summary',
  'regional_performance',
];

/**
 * Pages restricted to super_admin only by default.
 */
export const ADMIN_ONLY_PAGES: DashboardPage[] = [
  'admin_settings',
  'user_permission_management',
];

/**
 * Compute the full set of 13 page permissions for a given role.
 * Returns concrete permission entries for every DashboardPage.
 */
export function getDefaultPermissionsForRole(
  role: UserRole
): Array<{ page: DashboardPage; permissionLevel: PermissionLevel }> {
  return ALL_DASHBOARD_PAGES.map((page) => {
    if (role === 'super_admin') {
      return { page, permissionLevel: 'write' as PermissionLevel };
    }

    if (ADMIN_ONLY_PAGES.includes(page)) {
      return { page, permissionLevel: 'no_access' as PermissionLevel };
    }

    if (role === 'staff') {
      return {
        page,
        permissionLevel: (STAFF_READABLE_PAGES.includes(page) ? 'read' : 'no_access') as PermissionLevel,
      };
    }

    // executive and manager
    return { page, permissionLevel: ROLE_DEFAULTS[role] };
  });
}

/**
 * Resolve the effective permission for a user on a page.
 * Uses cached permissions from req.user when available to avoid N+1 DB queries.
 * Falls back to a DB query only if permissions array is not provided.
 */
async function resolvePermission(
  userId: number,
  role: UserRole,
  page: DashboardPage,
  permissions?: UserPermission[]
): Promise<PermissionLevel> {
  // Check for explicit permission — use in-memory array if available
  let explicit: { permissionLevel: PermissionLevel } | undefined | null;

  if (permissions) {
    explicit = permissions.find((p) => p.page === page);
  } else {
    // Fallback to DB query (only when permissions not loaded on req.user)
    explicit = await prisma.userPermission.findUnique({
      where: { userId_page: { userId, page } },
    });
  }

  if (explicit) return explicit.permissionLevel;

  // Super admin gets write access to everything
  if (role === 'super_admin') return 'write';

  // Admin-only pages
  if (ADMIN_ONLY_PAGES.includes(page)) return 'no_access';

  // Staff gets read on certain pages, no_access otherwise
  if (role === 'staff') {
    return STAFF_READABLE_PAGES.includes(page) ? 'read' : 'no_access';
  }

  // Executive and Manager get role default
  return ROLE_DEFAULTS[role];
}

/**
 * Permission levels ranked for comparison.
 */
const LEVEL_RANK: Record<PermissionLevel, number> = {
  no_access: 0,
  read: 1,
  write: 2,
};

/**
 * Middleware factory that checks if the authenticated user has
 * at least the required permission level for the specified page.
 *
 * Usage: router.get('/some-route', requirePermission('financial_deep_dive', 'read'), handler)
 */
export function requirePermission(page: DashboardPage, requiredLevel: PermissionLevel) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    // If no user attached (dev mode with DB issues), allow through
    if (!user) {
      if (process.env.NODE_ENV === 'development') return next();

      res.status(401).json({
        error: { message: 'Authentication required', statusCode: 401 },
      });
      return;
    }

    // Pass cached permissions from req.user to avoid N+1 DB queries.
    // auth.ts loads permissions via getUserWithPermissions (include: { permissions: true })
    // and getDevUser now also includes permissions.
    const cachedPermissions = (user as any).permissions as UserPermission[] | undefined;

    const effectiveLevel = await resolvePermission(
      user.id,
      user.role as UserRole,
      page,
      cachedPermissions
    );

    if (LEVEL_RANK[effectiveLevel] < LEVEL_RANK[requiredLevel]) {
      res.status(403).json({
        error: {
          message: 'You do not have permission to access this resource',
          statusCode: 403,
        },
      });
      return;
    }

    next();
  };
}
