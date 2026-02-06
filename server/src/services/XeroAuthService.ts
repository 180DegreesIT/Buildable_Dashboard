import crypto from 'crypto';
import prisma from '../db.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface XeroConnectionStatus {
  connected: boolean;
  tenantName?: string;
  lastSyncAt?: Date | null;
  mockMode: boolean;
}

// ─── XeroAuthService ──────────────────────────────────────────────────────────

/**
 * Handles Xero OAuth2 authorisation flow, token encryption/decryption,
 * and connection status. Supports mock mode for development without
 * live Xero credentials.
 *
 * Token encryption uses AES-256-GCM with a random IV per encryption.
 * Format: iv:authTag:ciphertext (all hex-encoded).
 */
export class XeroAuthService {
  private static instance: XeroAuthService;
  private encryptionKey: Buffer | null = null;
  private refreshPromise: Promise<void> | null = null;

  private constructor() {
    // Validate encryption key at construction if not in mock mode
    const keyHex = process.env.XERO_ENCRYPTION_KEY;
    if (keyHex) {
      if (keyHex.length !== 64) {
        throw new Error(
          'XERO_ENCRYPTION_KEY must be 64 hex characters (32 bytes). ' +
          'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
        );
      }
      this.encryptionKey = Buffer.from(keyHex, 'hex');
    }
  }

  static getInstance(): XeroAuthService {
    if (!XeroAuthService.instance) {
      XeroAuthService.instance = new XeroAuthService();
    }
    return XeroAuthService.instance;
  }

  // ─── Mock Mode ────────────────────────────────────────────────────────────

  /**
   * Returns true when XERO_MOCK_MODE is 'true' or not set (defaults to mock).
   */
  isMockMode(): boolean {
    const mode = process.env.XERO_MOCK_MODE;
    // Default to true if not set (safe for development)
    return mode === undefined || mode === '' || mode === 'true';
  }

  // ─── Encryption ───────────────────────────────────────────────────────────

  private getEncryptionKey(): Buffer {
    if (this.isMockMode()) {
      // In mock mode, use a deterministic key for fake tokens
      return crypto.createHash('sha256').update('mock-encryption-key').digest();
    }
    if (!this.encryptionKey) {
      throw new Error(
        'XERO_ENCRYPTION_KEY is required for non-mock mode. ' +
        'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }
    return this.encryptionKey;
  }

  encrypt(plaintext: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(ciphertext: string): string {
    const key = this.getEncryptionKey();
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted token format');
    }
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  // ─── OAuth2 Flow ──────────────────────────────────────────────────────────

  /**
   * Returns the Xero consent URL to initiate OAuth2 flow.
   * In mock mode, returns a self-redirect URL that simulates consent.
   */
  async getConsentUrl(): Promise<string> {
    if (this.isMockMode()) {
      return '/api/v1/xero/callback?mock=true';
    }

    // Real mode: build Xero OAuth2 authorisation URL
    const clientId = process.env.XERO_CLIENT_ID;
    if (!clientId) {
      throw new Error('XERO_CLIENT_ID environment variable is required');
    }

    const serverUrl = process.env.SERVER_URL || 'http://localhost:6001';
    const redirectUri = `${serverUrl}/api/v1/xero/callback`;
    const scopes = [
      'openid',
      'profile',
      'email',
      'accounting.settings',
      'accounting.transactions',
      'accounting.reports.read',
      'accounting.contacts.read',
      'offline_access',
    ].join(' ');

    const state = crypto.randomBytes(16).toString('hex');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes,
      state,
    });

    return `https://login.xero.com/identity/connect/authorize?${params.toString()}`;
  }

  /**
   * Handles the OAuth2 callback. In mock mode, stores a fake token.
   * In real mode, exchanges the authorisation code for tokens via Xero API.
   */
  async handleCallback(url: string): Promise<void> {
    const parsedUrl = new URL(url, 'http://localhost');
    const isMock = parsedUrl.searchParams.get('mock') === 'true';

    if (isMock || this.isMockMode()) {
      // Mock mode: store fake encrypted tokens
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes

      await prisma.xeroToken.upsert({
        where: { tenantId: 'mock-tenant-001' },
        create: {
          tenantId: 'mock-tenant-001',
          tenantName: 'Mock Organisation',
          accessToken: this.encrypt('mock-access-token-' + Date.now()),
          refreshToken: this.encrypt('mock-refresh-token-' + Date.now()),
          idToken: null,
          tokenType: 'Bearer',
          expiresAt,
          scope: 'openid profile email accounting.settings accounting.transactions accounting.reports.read accounting.contacts.read offline_access',
          connectedAt: now,
        },
        update: {
          accessToken: this.encrypt('mock-access-token-' + Date.now()),
          refreshToken: this.encrypt('mock-refresh-token-' + Date.now()),
          expiresAt,
        },
      });

      return;
    }

    // Real mode: exchange code for tokens via Xero API
    const code = parsedUrl.searchParams.get('code');
    if (!code) {
      throw new Error('Missing authorisation code in callback URL');
    }

    const clientId = process.env.XERO_CLIENT_ID;
    const clientSecret = process.env.XERO_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('XERO_CLIENT_ID and XERO_CLIENT_SECRET are required');
    }

    const serverUrl = process.env.SERVER_URL || 'http://localhost:6001';
    const redirectUri = `${serverUrl}/api/v1/xero/callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      throw new Error(`Xero token exchange failed: ${errorBody}`);
    }

    const tokens = await tokenResponse.json() as {
      access_token: string;
      refresh_token: string;
      id_token?: string;
      token_type: string;
      expires_in: number;
      scope: string;
    };

    // Get tenant (organisation) info via connections endpoint
    const connectionsResponse = await fetch('https://api.xero.com/connections', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!connectionsResponse.ok) {
      throw new Error('Failed to fetch Xero tenant connections');
    }

    const connections = await connectionsResponse.json() as Array<{
      tenantId: string;
      tenantName: string;
    }>;

    if (!connections.length) {
      throw new Error('No Xero organisations connected');
    }

    // Use the first connected organisation
    const tenant = connections[0];
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.xeroToken.upsert({
      where: { tenantId: tenant.tenantId },
      create: {
        tenantId: tenant.tenantId,
        tenantName: tenant.tenantName,
        accessToken: this.encrypt(tokens.access_token),
        refreshToken: this.encrypt(tokens.refresh_token),
        idToken: tokens.id_token || null,
        tokenType: tokens.token_type,
        expiresAt,
        scope: tokens.scope,
      },
      update: {
        tenantName: tenant.tenantName,
        accessToken: this.encrypt(tokens.access_token),
        refreshToken: this.encrypt(tokens.refresh_token),
        idToken: tokens.id_token || null,
        expiresAt,
        scope: tokens.scope,
      },
    });
  }

  /**
   * Returns an authenticated access token string for API calls.
   * In mock mode, returns null (sync service uses mock data instead).
   * Handles token refresh with mutex to prevent concurrent refreshes.
   */
  async getAuthenticatedToken(): Promise<{ accessToken: string; tenantId: string } | null> {
    if (this.isMockMode()) {
      return null;
    }

    const token = await prisma.xeroToken.findFirst();
    if (!token) {
      throw new Error('Xero is not connected. Please authorise first.');
    }

    // Check if token is expired (with 60-second buffer)
    const now = new Date();
    const bufferMs = 60 * 1000;
    if (token.expiresAt.getTime() - bufferMs <= now.getTime()) {
      // Need to refresh -- use mutex to prevent concurrent refreshes
      if (!this.refreshPromise) {
        this.refreshPromise = this.refreshAccessToken(token.tenantId)
          .finally(() => { this.refreshPromise = null; });
      }
      await this.refreshPromise;

      // Re-fetch the updated token
      const refreshed = await prisma.xeroToken.findFirst();
      if (!refreshed) {
        throw new Error('Token refresh failed: no token found after refresh');
      }
      return {
        accessToken: this.decrypt(refreshed.accessToken),
        tenantId: refreshed.tenantId,
      };
    }

    return {
      accessToken: this.decrypt(token.accessToken),
      tenantId: token.tenantId,
    };
  }

  /**
   * Refreshes the Xero access token using the refresh token.
   */
  private async refreshAccessToken(tenantId: string): Promise<void> {
    const token = await prisma.xeroToken.findUnique({
      where: { tenantId },
    });
    if (!token) {
      throw new Error('Cannot refresh: token not found');
    }

    const clientId = process.env.XERO_CLIENT_ID;
    const clientSecret = process.env.XERO_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('XERO_CLIENT_ID and XERO_CLIENT_SECRET are required for token refresh');
    }

    const refreshToken = this.decrypt(token.refreshToken);

    const response = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      // If refresh fails, delete the token (user needs to re-authorise)
      await prisma.xeroToken.delete({ where: { tenantId } });
      throw new Error(`Token refresh failed: ${errorBody}. Please reconnect to Xero.`);
    }

    const tokens = await response.json() as {
      access_token: string;
      refresh_token: string;
      id_token?: string;
      expires_in: number;
      scope: string;
    };

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.xeroToken.update({
      where: { tenantId },
      data: {
        accessToken: this.encrypt(tokens.access_token),
        refreshToken: this.encrypt(tokens.refresh_token),
        idToken: tokens.id_token || null,
        expiresAt,
        scope: tokens.scope,
      },
    });
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  /**
   * Returns the current Xero connection status.
   */
  async getConnectionStatus(): Promise<XeroConnectionStatus> {
    const token = await prisma.xeroToken.findFirst();
    return {
      connected: !!token,
      tenantName: token?.tenantName,
      lastSyncAt: token?.lastSyncAt ?? null,
      mockMode: this.isMockMode(),
    };
  }

  // ─── Disconnect ───────────────────────────────────────────────────────────

  /**
   * Disconnects from Xero by deleting all stored tokens.
   */
  async disconnect(): Promise<void> {
    await prisma.xeroToken.deleteMany();
  }

  /**
   * Updates the lastSyncAt timestamp on the stored token.
   */
  async updateLastSyncAt(): Promise<void> {
    const token = await prisma.xeroToken.findFirst();
    if (token) {
      await prisma.xeroToken.update({
        where: { id: token.id },
        data: { lastSyncAt: new Date() },
      });
    }
  }
}
