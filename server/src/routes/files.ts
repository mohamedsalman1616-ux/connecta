import { Router } from 'express'; import multer from 'multer'; import crypto from 'crypto'; import path from 'path'; import fs from 'fs';
import { Upload } from '../models'; import { requireAuth } from '../middleware/auth';
export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads'); fs.mkdirSync(UPLOAD_DIR, { recursive: true });
export const KEY = /^[a-f0-9]{32}\.[a-z0-9]{3,5}$/;
const X = 'application/vnd.openxmlformats-officedocument.';
// Allow-list only. No html/svg/js/exe: nothing a browser could execute.
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm',
  'audio/webm': 'weba', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'application/pdf': 'pdf', 'text/plain': 'txt',
  [X + 'wordprocessingml.document']: 'docx', [X + 'spreadsheetml.sheet']: 'xlsx', [X + 'presentationml.presentation']: 'pptx' };
const SIG: Record<string, (b: Buffer) => boolean> = { // magic-byte check so a renamed file can't pose as an image/PDF
  png: b => b.subarray(0, 4).toString('hex') === '89504e47', jpg: b => b.subarray(0, 3).toString('hex') === 'ffd8ff',
  gif: b => b.subarray(0, 4).toString() === 'GIF8', pdf: b => b.subarray(0, 4).toString() === '%PDF', webp: b => b.subarray(8, 12).toString() === 'WEBP' };
const upload = multer({ limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  storage: multer.diskStorage({ destination: UPLOAD_DIR, filename: (_q, f, cb) => cb(null, `${crypto.randomBytes(16).toString('hex')}.${EXT[f.mimetype] ?? 'bin'}`) }),
  fileFilter: (_q, f, cb) => cb(null, !!EXT[f.mimetype]) });
const r = Router();
r.post('/files', requireAuth, (req, res, next) => upload.single('file')(req, res, (e: any) => e ? res.status(400).json({ error: e.message }) : next()), async (req: any, res) => {
  const f = req.file; if (!f) return res.status(400).json({ error: 'Unsupported or missing file type' });
  const ext = path.extname(f.filename).slice(1), head = Buffer.alloc(16); const fd = fs.openSync(f.path, 'r'); fs.readSync(fd, head, 0, 16, 0); fs.closeSync(fd);
  if (SIG[ext] && !SIG[ext](head)) { fs.unlinkSync(f.path); return res.status(400).json({ error: 'File content does not match its type' }); }
  const name = path.basename(f.originalname).replace(/[^\w.\- ]/g, '_').slice(0, 100);
  await Upload.create({ key: f.filename, owner: req.user.id, name, mime: f.mimetype, size: f.size });
  res.json({ key: f.filename, name, mime: f.mimetype, size: f.size });
});
export async function ownedUpload(key: string, owner: string, mimePrefix = '') {
  const u = await Upload.findOne({ key, owner }).lean(); return u && (u.mime ?? '').startsWith(mimePrefix) ? u : null;
}
export function sendStored(res: any, key: string, mime: string, name: string, download: boolean) {
  if (!KEY.test(key)) return res.status(404).end();
  res.set({ 'Content-Type': mime, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store',
    'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(name)}` });
  res.sendFile(path.join(UPLOAD_DIR, key), (e: any) => { if (e && !res.headersSent) res.status(404).end(); });
}
export default r;
