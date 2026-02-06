import { ConfidentialClientApplication } from '@azure/msal-node';
import jwt from 'jsonwebtoken';
import prisma from '../db.js';
import type { User } from '../generated/prisma/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRY = '8h';

// M365 / Azure AD configuration
function getMsalConfig() {
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
  const tenantId = process.env.AZURE_AD_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId) {
    return null;
  }

  return {
    auth: {
      clientId,
      clientSecret,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
  };
}

let msalClient: ConfidentialClientApplication | null = null;

function getMsalClient(): ConfidentialClientApplication | null {
  if (msalClient) return msalClient;

  const config = getMsalConfig();
  if (!config) return null;

  msalClient = new ConfidentialClientApplication(config);
  return msalClient;
}

export class AuthService {
  /**
   * Check if M365 SSO is configured (Azure AD credentials present).
   */
  static isSsoConfigured(): boolean {
    return getMsalConfig() !== null;
  }

  /**
   * Generate the M365 authorization URL for the login redirect.
   */
  static async getAuthUrl(redirectUri: string): Promise<string | null> {
    const client = getMsalClient();
    if (!client) return null;

    const response = await client.getAuthCodeUrl({
      scopes: ['user.read', 'openid', 'profile', 'email'],
      redirectUri,
    });

    return response;
  }

  /**
   * Exchange the authorization code for tokens and extract user profile.
   */
  static async handleCallback(code: string, redirectUri: string): Promise<User | null> {
    const client = getMsalClient();
    if (!client) return null;

    const tokenResponse = await client.acquireTokenByCode({
      code,
      scopes: ['user.read', 'openid', 'profile', 'email'],
      redirectUri,
    });

    if (!tokenResponse || !tokenResponse.account) return null;

    const account = tokenResponse.account;
    const m365Id = account.homeAccountId;
    const email = account.username;
    const displayName = account.name || email;

    // Auto-provision user on first login
    const user = await prisma.user.upsert({
      where: { m365Id },
      update: { lastLogin: new Date() },
      create: {
        m365Id,
        email,
        displayName,
        role: 'staff', // Default role — admin must upgrade
        isActive: true,
        lastLogin: new Date(),
      },
    });

    return user;
  }

  /**
   * Issue a JWT for the authenticated user.
   */
  static signToken(user: User): string {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
  }

  /**
   * Verify and decode a JWT.
   */
  static verifyToken(token: string): { userId: number; email: string; role: string } | null {
    try {
      return jwt.verify(token, JWT_SECRET) as any;
    } catch {
      return null;
    }
  }

  /**
   * Get or create the dev bypass user (used when NODE_ENV=development).
   * Includes permissions so the permission middleware can check in-memory.
   */
  static async getDevUser(): Promise<User> {
    const email = process.env.DEV_USER_EMAIL || 'admin@buildable.com.au';
    const displayName = process.env.DEV_USER_NAME || 'Dev Admin';

    // Upsert the user first
    const user = await prisma.user.upsert({
      where: { email },
      update: { lastLogin: new Date() },
      create: {
        email,
        displayName,
        role: 'super_admin',
        isActive: true,
        lastLogin: new Date(),
      },
    });

    // Re-fetch with permissions included (upsert doesn't reliably include relations)
    const userWithPerms = await prisma.user.findUnique({
      where: { id: user.id },
      include: { permissions: true },
    });

    return userWithPerms ?? user;
  }

  /**
   * Get user by ID with their permissions.
   */
  static async getUserWithPermissions(userId: number) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: { permissions: true },
    });
  }
}
