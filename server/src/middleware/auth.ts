import jwt from 'jsonwebtoken';
import { Response, NextFunction } from 'express';
import { User } from '../models';
export const sign = (u: { id: string; tv: number }) => jwt.sign(u, process.env.JWT_SECRET!, { expiresIn: '12h' });
export const session = (u: any) => ({ token: sign({ id: String(u._id), tv: u.tokenVersion ?? 0 }), user: publicSelf(u) });
export const publicSelf = (u: any) => ({ id: String(u._id), username: u.username, displayName: u.displayName, role: u.role, bio: u.bio, status: u.status, settings: u.settings });
/** Validates the JWT AND re-reads role + tokenVersion from the DB, so logout/role changes take effect immediately. */
export async function authenticate(token: string) {
  const p = jwt.verify(token, process.env.JWT_SECRET!) as any;
  const u = await User.findById(p.id).select('role tokenVersion').lean();
  if (!u || (u.tokenVersion ?? 0) !== p.tv) throw new Error('revoked');
  return { id: String(u._id), role: u.role };
}
const bearer = (req: any) => String(req.headers.authorization ?? '').replace(/^Bearer /, '');
export async function requireAuth(req: any, res: Response, next: NextFunction) {
  try { req.user = await authenticate(bearer(req)); next(); } catch { res.status(401).json({ error: 'Unauthorized' }); }
}
/** For <img>/<video> tags that cannot send headers; ONLY used on file-streaming routes. */
export async function requireAuthOrQuery(req: any, res: Response, next: NextFunction) {
  try { req.user = await authenticate(bearer(req) || String(req.query.token ?? '')); next(); } catch { res.status(401).json({ error: 'Unauthorized' }); }
}
export const guardIds = (_r: any, res: Response, next: NextFunction, v: string) => /^[a-f0-9]{24}$/.test(v) ? next() : res.status(400).json({ error: 'Bad id' });
