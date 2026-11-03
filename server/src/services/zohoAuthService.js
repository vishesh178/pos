const axios = require('axios');
const prisma = require('../prisma');
const { encrypt, decrypt } = require('../utils/crypto');

// India Data Center domains
const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.in';
const ZOHO_API_URL = 'https://www.zohoapis.in';

const DEFAULT_SCOPES = [
  'ZohoBooks.fullaccess.all',
  'ZohoInventory.fullaccess.all',
].join(',');

/**
 * Generate official OAuth 2.0 consent URL
 */
function getAuthorizationUrl({ clientId, redirectUri, state = 'curated_art_pos' }) {
  if (!clientId || !redirectUri) {
    throw new Error('Client ID and Redirect URI are required to generate Zoho OAuth URL.');
  }

  const params = new URLSearchParams({
    scope: DEFAULT_SCOPES,
    client_id: clientId,
    response_type: 'code',
    access_type: 'offline', // Critical for receiving refresh_token
    redirect_uri: redirectUri,
    prompt: 'consent',
    state,
  });

  return `${ZOHO_ACCOUNTS_URL}/oauth/v2/auth?${params.toString()}`;
}

/**
 * Exchange OAuth authorization code for Access & Refresh tokens
 */
async function exchangeCodeForTokens({ code, clientId, clientSecret, redirectUri }) {
  if (!code || !clientId || !clientSecret || !redirectUri) {
    throw new Error('Code, Client ID, Client Secret, and Redirect URI are required.');
  }

  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await axios.post(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token`, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });

  const data = response.data;
  if (data.error) {
    throw new Error(`Zoho OAuth Error: ${data.error}`);
  }

  const { access_token, refresh_token, expires_in } = data;
  const tokenExpiresAt = new Date(Date.now() + (expires_in - 300) * 1000); // 5 min buffer

  // Store encrypted credentials in ZohoConfig
  const updated = await prisma.zohoConfig.upsert({
    where: { id: 'default' },
    update: {
      clientId,
      clientSecretEncrypted: encrypt(clientSecret),
      refreshTokenEncrypted: refresh_token ? encrypt(refresh_token) : undefined,
      accessToken: access_token,
      tokenExpiresAt,
      isConnected: true,
      dcDomain: 'in',
    },
    create: {
      id: 'default',
      clientId,
      clientSecretEncrypted: encrypt(clientSecret),
      refreshTokenEncrypted: refresh_token ? encrypt(refresh_token) : null,
      accessToken: access_token,
      tokenExpiresAt,
      isConnected: true,
      dcDomain: 'in',
    },
  });

  return { success: true, tokenExpiresAt };
}

/**
 * Get valid Access Token, automatically refreshing if expired or expiring soon
 */
async function getValidAccessToken() {
  const config = await prisma.zohoConfig.findUnique({ where: { id: 'default' } });
  if (!config || !config.isConnected) {
    throw new Error('Zoho is not connected. Please configure OAuth credentials in Zoho Settings.');
  }

  // Check if current access token is still valid (with 5 min safety buffer)
  if (config.accessToken && config.tokenExpiresAt && new Date() < new Date(config.tokenExpiresAt)) {
    return {
      accessToken: config.accessToken,
      organizationId: config.organizationId,
    };
  }

  // Token is expired; refresh using encrypted refreshToken
  if (!config.refreshTokenEncrypted || !config.clientSecretEncrypted || !config.clientId) {
    throw new Error('Missing encrypted refresh token or client secret for Zoho token refresh.');
  }

  const refreshToken = decrypt(config.refreshTokenEncrypted);
  const clientSecret = decrypt(config.clientSecretEncrypted);

  if (!refreshToken || !clientSecret) {
    throw new Error('Failed to decrypt Zoho credentials. Vault key may have changed.');
  }

  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });

  try {
    const response = await axios.post(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token`, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    });

    const data = response.data;
    if (data.error) {
      throw new Error(`Token refresh failed: ${data.error}`);
    }

    const { access_token, expires_in } = data;
    const tokenExpiresAt = new Date(Date.now() + (expires_in - 300) * 1000);

    await prisma.zohoConfig.update({
      where: { id: 'default' },
      data: {
        accessToken: access_token,
        tokenExpiresAt,
      },
    });

    return {
      accessToken: access_token,
      organizationId: config.organizationId,
    };
  } catch (err) {
    console.error('Zoho token refresh error:', err.message);
    throw new Error('Failed to refresh Zoho access token: ' + err.message);
  }
}

module.exports = {
  ZOHO_ACCOUNTS_URL,
  ZOHO_API_URL,
  DEFAULT_SCOPES,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  getValidAccessToken,
};

