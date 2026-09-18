import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface AccessIdentity { issuer: string; subject: string; }

export interface AccessEnvironment { ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string; }

export interface OidcProvider { issuer: string; audience: string; jwksUrl: string; }

/**
 * Provider-neutral OIDC boundary. Future consumer auth supplies its issuer,
 * audience, JWKS URL and bearer token here; product tables keep principal_id.
 */
export async function verifyOidcToken(token: string, provider: OidcProvider): Promise<AccessIdentity | null> {
  const jwks = createRemoteJWKSet(new URL(provider.jwksUrl));
  const { payload } = await jwtVerify(token, jwks, { issuer: provider.issuer, audience: provider.audience });
  if (typeof payload.iss !== 'string' || typeof payload.sub !== 'string') return null;
  return { issuer: payload.iss, subject: payload.sub };
}

export async function verifyAccessIdentity(request: Request, env: AccessEnvironment): Promise<AccessIdentity | null> {
  const token = request.headers.get('CF-Access-Jwt-Assertion');
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;
  const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
  return verifyOidcToken(token, { issuer, audience: env.ACCESS_AUD, jwksUrl: `${issuer}/cdn-cgi/access/certs` });
}
