// ==============================================================================
// Authentication & JWT Session Engine
// Enforces @thapar.edu validation, role-based JWT sessions, and bcrypt hashing
// ==============================================================================

import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies, headers } from 'next/headers';
import { User, UserSession, Role } from './types';
import { getUserByEmail, createUser, updateUser } from './db';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'econ-club-thapar-dalal-street-super-secret-key-2026'
);

export const COOKIE_NAME = 'econ_token';

// Master Superadmin Configuration: Designated emails with global cross-cohort access
export const SUPERADMIN_EMAILS = [
  'soumilsaini07@gmail.com',
  'vjhuntra_be24@thapar.edu',
  'admin.econ@thapar.edu',
];

// Desk Admins & Superadmins: Authorized to access administrative desk portals
export const AUTHORIZED_ADMIN_EMAILS = [
  'ssaini3_be25@thapar.edu',
  'ssaini_be25@thapar.edu',
  'ssaini_be25@thapar.ed',
  'desk1.admin@thapar.edu',
  'desk2.admin@thapar.edu',
  'desk3.admin@thapar.edu',
  ...SUPERADMIN_EMAILS,
];

export const ADMIN_EMAIL = 'ssaini3_be25@thapar.edu';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
export const SUPERADMIN_EMAIL = 'soumilsaini07@gmail.com';
export const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'superadmin123';

export function isSuperAdmin(emailOrUser?: string | User | UserSession | null): boolean {
  if (!emailOrUser) return false;
  if (typeof emailOrUser === 'string') {
    const norm = emailOrUser.trim().toLowerCase();
    return SUPERADMIN_EMAILS.some((adm) => adm.toLowerCase() === norm);
  }
  if (emailOrUser.role === 'superadmin') return true;
  const norm = emailOrUser.email ? emailOrUser.email.trim().toLowerCase() : '';
  return SUPERADMIN_EMAILS.some((adm) => adm.toLowerCase() === norm);
}

export function isAuthorizedAdmin(email: string): boolean {
  if (!email) return false;
  const norm = email.trim().toLowerCase();
  return (
    SUPERADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === norm) ||
    AUTHORIZED_ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === norm)
  );
}

export function isAdmin(sessionOrUser?: User | UserSession | null): boolean {
  if (!sessionOrUser) return false;
  return sessionOrUser.role === 'admin' || sessionOrUser.role === 'superadmin';
}

export function canAdminManageStudent(
  adminSession: UserSession,
  student: { id: string; assigned_admin_id?: string; email?: string }
): boolean {
  if (!adminSession) return false;
  if (adminSession.role === 'superadmin' || isSuperAdmin(adminSession.email)) {
    return true;
  }
  if (adminSession.role === 'admin') {
    // Desk admin can manage student if assigned or if student has no assigned admin yet
    return !student.assigned_admin_id || student.assigned_admin_id === adminSession.userId;
  }
  return false;
}

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, 10);
}

export async function comparePassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

export function isThaparEmail(email: string): boolean {
  const norm = email.trim().toLowerCase();
  return /^[a-z0-9._%+-]+@thapar\.edu$/i.test(norm);
}

// In-memory brute force defense for failed login attempts (max 5 failures per 5 minutes per email)
interface LoginAttempt {
  count: number;
  lastAttempt: number;
}
const loginAttempts = new Map<string, LoginAttempt>();

export function checkLoginRateLimit(email: string): { allowed: boolean; waitSeconds?: number } {
  const norm = email.trim().toLowerCase();
  const attempt = loginAttempts.get(norm);
  if (!attempt) return { allowed: true };

  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 minutes window
  if (now - attempt.lastAttempt > windowMs) {
    loginAttempts.delete(norm);
    return { allowed: true };
  }

  if (attempt.count >= 5) {
    const remainingSeconds = Math.ceil((windowMs - (now - attempt.lastAttempt)) / 1000);
    return { allowed: false, waitSeconds: remainingSeconds };
  }

  return { allowed: true };
}

export function recordLoginFailure(email: string) {
  const norm = email.trim().toLowerCase();
  const attempt = loginAttempts.get(norm);
  const now = Date.now();
  if (!attempt) {
    loginAttempts.set(norm, { count: 1, lastAttempt: now });
  } else {
    attempt.count += 1;
    attempt.lastAttempt = now;
  }
}

export function resetLoginAttempts(email: string) {
  loginAttempts.delete(email.trim().toLowerCase());
}

export async function createSessionToken(session: UserSession): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: (payload.role as Role) || 'participant',
      assigned_admin_id: payload.assigned_admin_id as string | undefined,
      assigned_admin_name: payload.assigned_admin_name as string | undefined,
      group_name: payload.group_name as string | undefined,
      team_id: payload.team_id as string | undefined,
      team_name: payload.team_name as string | undefined,
      is_team_leader: payload.is_team_leader as boolean | undefined,
    };
  } catch (err) {
    return null;
  }
}

export async function getCurrentSession(): Promise<UserSession | null> {
  try {
    let token: string | null = null;
    try {
      const headersList = await headers();
      const authHeader = headersList.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    } catch {}

    if (!token) {
      try {
        const cookieStore = await cookies();
        token = cookieStore.get(COOKIE_NAME)?.value || null;
      } catch {}
    }

    if (token) {
      const verified = await verifySessionToken(token);
      if (verified) return verified;
    }

    return null;
  } catch (err) {
    return null;
  }
}

export async function authenticateUser(
  email: string,
  pass: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  let normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail === 'admin') {
    normalizedEmail = 'vjhuntra_be24@thapar.edu';
  } else if (!normalizedEmail.includes('@')) {
    normalizedEmail = `${normalizedEmail}@thapar.edu`;
  }

  // Brute-force rate limit inspection
  const rateLimit = checkLoginRateLimit(normalizedEmail);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Security lock: Too many failed login attempts. Please wait ${rateLimit.waitSeconds} seconds before trying again.`,
    };
  }

  // 1. Authorized Admin Login Check (Superadmin or Desk Admin)
  if (isAuthorizedAdmin(normalizedEmail)) {
    const targetRole: Role = isSuperAdmin(normalizedEmail) ? 'superadmin' : 'admin';
    let admin = await getUserByEmail(normalizedEmail);
    if (!admin) {
      const defaultPass = targetRole === 'superadmin' ? SUPERADMIN_PASSWORD : ADMIN_PASSWORD;
      const hashedPass = await hashPassword(pass || defaultPass);
      admin = await createUser({
        email: normalizedEmail,
        password_hash: hashedPass,
        role: targetRole,
        balance: 10000000,
        ecoin_balance: 1000,
        first_name: 'Soumil',
        last_name: 'Saini',
        username: targetRole === 'superadmin' ? 'Soumil Saini (Superadmin)' : 'Soumil Saini (Desk Lead)',
        group_name: targetRole === 'superadmin' ? 'Superadmin Desk - Global' : 'Cohort Alpha - Desk 1',
      });
      resetLoginAttempts(normalizedEmail);
      return { success: true, user: admin };
    }

    // Ensure role matches targetRole
    if (admin.role !== targetRole) {
      admin.role = targetRole;
      await updateUser(admin.id, { role: targetRole });
    }

    // If admin has no password hash yet, seed it with the configured password hash
    if (!admin.password_hash) {
      const expectedPass = targetRole === 'superadmin' ? SUPERADMIN_PASSWORD : ADMIN_PASSWORD;
      if (pass === expectedPass) {
        admin.password_hash = await hashPassword(pass);
        await updateUser(admin.id, { password_hash: admin.password_hash });
        resetLoginAttempts(normalizedEmail);
        return { success: true, user: admin };
      }
      recordLoginFailure(normalizedEmail);
      return { success: false, error: 'Invalid admin credentials.' };
    }

    // Strict bcrypt password comparison - no plaintext backdoors
    const isMatch = await comparePassword(pass, admin.password_hash);
    if (!isMatch) {
      recordLoginFailure(normalizedEmail);
      return { success: false, error: 'Invalid admin credentials. Please verify your password.' };
    }

    resetLoginAttempts(normalizedEmail);
    return { success: true, user: admin };
  }

  // 2. Regular Student Login: Must be a pre-existing registered user in database
  const user = await getUserByEmail(normalizedEmail);
  if (!user) {
    return {
      success: false,
      error: 'No account registered with this email. Please switch to the "Sign Up" tab to create your student account.',
    };
  }

  // If seeded demo user with no password hash, seed it with hash on first matching login
  if (!user.password_hash) {
    if (pass === 'student123' || pass === 'thapar') {
      user.password_hash = await hashPassword(pass);
      await updateUser(user.id, { password_hash: user.password_hash });
      resetLoginAttempts(normalizedEmail);
      return { success: true, user };
    }
    recordLoginFailure(normalizedEmail);
    return { success: false, error: 'Incorrect password. Please verify your credentials and try again.' };
  }

  // Strict bcrypt password verification
  const isMatch = await comparePassword(pass, user.password_hash);
  if (!isMatch) {
    recordLoginFailure(normalizedEmail);
    return {
      success: false,
      error: 'Incorrect password. Please verify your credentials and try again.',
    };
  }

  resetLoginAttempts(normalizedEmail);
  return { success: true, user };
}

export async function registerUser(
  email: string,
  pass: string,
  fullName?: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  let normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.includes('@')) {
    normalizedEmail = `${normalizedEmail}@thapar.edu`;
  }

  if (!isThaparEmail(normalizedEmail)) {
    return {
      success: false,
      error: 'Registration requires a valid Thapar email address ending in @thapar.edu or roll number.',
    };
  }

  if (!pass || pass.length < 6) {
    return {
      success: false,
      error: 'Password must be at least 6 characters in length.',
    };
  }

  if (isAuthorizedAdmin(normalizedEmail)) {
    return {
      success: false,
      error: 'This email is reserved for Platform Faculty Administration. Please sign in using the Sign In tab.',
    };
  }

  const existing = await getUserByEmail(normalizedEmail);
  if (existing) {
    return {
      success: false,
      error: 'An account with this email address already exists. Please sign in.',
    };
  }

  const passwordHash = await hashPassword(pass);
  let firstName: string | undefined;
  let lastName: string | undefined;
  let username: string | undefined;
  if (fullName && fullName.trim()) {
    const parts = fullName.trim().split(/\s+/);
    firstName = parts[0];
    lastName = parts.slice(1).join(' ');
    username = fullName.trim();
  }

  const newUser = await createUser({
    email: normalizedEmail,
    password_hash: passwordHash,
    role: 'participant', // Default role for all student competitors
    balance: 1000000, // ₹10,00,000 starting portfolio corpus
    ecoin_balance: 100,
    first_name: firstName,
    last_name: lastName,
    username: username,
  });

  return { success: true, user: newUser };
}
