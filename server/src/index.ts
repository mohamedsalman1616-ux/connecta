import 'dotenv/config'; import 'express-async-errors';
import http from 'http'; import express from 'express'; import cors from 'cors'; import helmet from 'helmet'; import rateLimit from 'express-rate-limit'; import mongoose from 'mongoose';
import auth from './routes/auth'; import users from './routes/users'; import groups from './routes/groups'; import messages from './routes/messages'; import files from './routes/files'; import misc from './routes/misc';
import roles, { migrateLegacyRoles } from './routes/roles';
import { initSocket } from './socket'; import { Message } from './models';
for (const k of ['MONGO_URI', 'JWT_SECRET']) if (!process.env[k]) { console.error(`Missing ${k}. Copy .env.example to .env first.`); process.exit(1); }
const app = express();
app.use(helmet({ crossOriginResourcePolicy: false }), cors({ origin: process.env.CLIENT_ORIGIN }), express.json({ limit: '1mb' }));
app.get('/api/health', (_q, r) => { r.json({ ok: true }); });
app.use('/api/auth', rateLimit({ windowMs: 60_000, limit: 30, message: { error: 'Too many attempts, slow down' } }), auth);
app.use('/api', rateLimit({ windowMs: 60_000, limit: 600 }), users, groups, messages, files, misc, roles);
app.use((e: any, _q: any, res: any, _n: any) => { console.error(e); res.status(e.status ?? 500).json({ error: e.status ? e.message : 'Server error' }); });
const server = http.createServer(app); initSocket(server);
mongoose.connect(process.env.MONGO_URI!).then(async () => {
  await migrateLegacyRoles();
  const port = +(process.env.PORT ?? 5000); server.listen(port, () => console.log(`Connecta API on http://localhost:${port}`));
  setInterval(() => Message.deleteMany({ disappear: true, 'perm.expiresAt': { $lt: new Date() } }).catch(() => {}), 30_000); // disappearing DMs
}).catch(e => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
