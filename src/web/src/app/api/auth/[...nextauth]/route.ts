// next-auth ^4.0.0
import NextAuth from 'next-auth';
import { Providers } from 'next-auth/providers';
import { JWT } from 'next-auth/jwt';
import { 
  User, 
  UserRole, 
  UserPermission, 
  AuthSession, 
  MFAMethod,
  LoginCredentials,
  MFACredentials,
  AuthError
} from '../../../../../types/auth';
import crypto from 'crypto';
import { headers } from 'next/headers';
import { rateLimit } from '../../../../utils/rate-limit';
import { validateDeviceFingerprint } from '../../../../utils/security';

// Constants for token expiration
const ACCESS_TOKEN_EXPIRY = 60 * 60; // 1 hour
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days

// Rate limiting configuration
const rateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5 // 5 attempts
});

/**
 * NextAuth configuration options with enhanced security features
 */
const authOptions = {
  providers: [
    // Credentials Provider with email/password authentication
    Providers.Credentials({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        organizationId: { label: 'Organization ID', type: 'text' },
        mfaToken: { label: 'MFA Token', type: 'text' },
        deviceId: { label: 'Device ID', type: 'text' },
        recaptchaToken: { label: 'reCAPTCHA Token', type: 'text' }
      },
      async authorize(credentials: LoginCredentials) {
        try {
          // Validate reCAPTCHA token
          await validateRecaptcha(credentials.recaptchaToken);

          // Check rate limiting
          const rateLimitResult = await rateLimiter.check(credentials.email);
          if (!rateLimitResult.success) {
            throw new Error('Too many login attempts. Please try again later.');
          }

          // Authenticate user
          const user = await authenticateUser(credentials);

          // Verify MFA if enabled
          if (user.mfaEnabled) {
            await verifyMFA({
              userId: user.id,
              code: credentials.mfaToken,
              method: user.mfaMethod as MFAMethod,
              deviceId: credentials.deviceId
            });
          }

          return user;
        } catch (error) {
          console.error('Authentication error:', error);
          return null;
        }
      }
    }),

    // OAuth Providers with PKCE
    Providers.Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code'
        }
      }
    }),

    Providers.Microsoft({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      authorization: {
        params: { scope: 'openid email profile' }
      }
    })
  ],

  session: {
    strategy: 'jwt',
    maxAge: ACCESS_TOKEN_EXPIRY,
    updateAge: 5 * 60 // 5 minutes
  },

  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        // Initial sign in
        return {
          accessToken: generateAccessToken(user),
          refreshToken: generateRefreshToken(user),
          user,
          deviceId: crypto.randomUUID()
        };
      }

      // Subsequent requests - check token expiration
      if (Date.now() < token.accessTokenExpires) {
        return token;
      }

      // Access token has expired, try to refresh
      return refreshAccessToken(token);
    },

    async session({ session, token }): Promise<AuthSession> {
      return {
        ...session,
        user: token.user as User,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        deviceId: token.deviceId,
        expiresAt: token.accessTokenExpires,
        ipAddress: headers().get('x-forwarded-for') || 'unknown',
        userAgent: headers().get('user-agent') || 'unknown'
      };
    },

    async signIn({ user, account, profile }) {
      try {
        // Verify organization membership
        await verifyOrganizationAccess(user.organizationId);

        // Check account status
        if (!user.isActive) {
          throw new Error('Account is inactive');
        }

        // Log successful sign-in
        await logAuthEvent({
          type: 'SIGN_IN',
          userId: user.id,
          deviceId: user.deviceId,
          success: true
        });

        return true;
      } catch (error) {
        console.error('Sign in error:', error);
        return false;
      }
    }
  },

  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
    mfa: '/auth/mfa'
  },

  events: {
    async signIn(message) {
      await logAuthEvent({
        type: 'SIGN_IN',
        ...message
      });
    },
    async signOut(message) {
      await invalidateDeviceSessions(message.deviceId);
    },
    async error(message) {
      await logAuthEvent({
        type: 'ERROR',
        ...message
      });
    }
  }
};

/**
 * GET request handler for NextAuth
 */
export async function GET(request: Request): Promise<Response> {
  // Validate request headers
  const origin = request.headers.get('origin');
  if (!isValidOrigin(origin)) {
    return new Response('Invalid origin', { status: 403 });
  }

  // Add security headers
  const response = await NextAuth(request, authOptions);
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');

  return response;
}

/**
 * POST request handler for NextAuth with enhanced security
 */
export async function POST(request: Request): Promise<Response> {
  try {
    // Validate CSRF token
    const csrfToken = request.headers.get('x-csrf-token');
    if (!await validateCsrfToken(csrfToken)) {
      throw new Error('Invalid CSRF token');
    }

    // Verify device fingerprint
    const deviceFingerprint = request.headers.get('x-device-fingerprint');
    if (!await validateDeviceFingerprint(deviceFingerprint)) {
      throw new Error('Invalid device fingerprint');
    }

    // Process authentication
    const response = await NextAuth(request, authOptions);

    // Add security headers
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');

    return response;
  } catch (error) {
    console.error('Authentication error:', error);
    return new Response(JSON.stringify({ 
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    }), { 
      status: 401,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}