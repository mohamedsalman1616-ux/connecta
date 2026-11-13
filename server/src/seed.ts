import 'dotenv/config'; import mongoose from 'mongoose'; import bcrypt from 'bcryptjs'; import crypto from 'crypto';
import { User, Group, GroupMember, Message, Contact, Notification, Story, Report } from './models';
import { migrateLegacyRoles } from './routes/roles';

const demo: [string, string, string][] = [
  ['manager', 'Manager', 'Project Director'],
  ['gm1', 'General Manager', 'GM Alice Chen'],
  ['gm2', 'General Manager', 'GM Robert Vance'],
  ['tl1', 'Team Leader', 'TL Clara Oswald'],
  ['tl2', 'Team Leader', 'TL David Miller'],
  ['staff1', 'Staff', 'Staff Emily Stone'],
  ['staff2', 'Staff', 'Staff Frank Wright'],
];

(async () => {
  if (!process.env.MONGO_URI) throw new Error('Missing MONGO_URI (copy .env.example to .env)');
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User.deleteMany({}), Group.deleteMany({}), GroupMember.deleteMany({}), Message.deleteMany({}), Contact.deleteMany({}), Notification.deleteMany({}), Story.deleteMany({}), Report.deleteMany({})]);
  
  await migrateLegacyRoles();

  const hash = await bcrypt.hash('demo123', 10);
  const users = await User.insertMany(demo.map(([username, role, displayName]) => ({
    username,
    role,
    displayName,
    passwordHash: hash,
    bio: `${role} at Connecta Luxury Platform`
  })));

  const by = Object.fromEntries(users.map(u => [u.username, u]));
  const id = (n: string) => String(by[n]._id);

  const mk = async (name: string, description: string) => {
    const g = await Group.create({ name, description, createdBy: users[0]._id, inviteCode: crypto.randomBytes(6).toString('hex') });
    await GroupMember.insertMany(users.map((u, i) => ({
      groupId: g._id,
      userId: u._id,
      role: u.role,
      admin: i === 0 ? 'admin' : u.username === 'gm1' ? 'coadmin' : 'none'
    })));
    return g;
  };

  const executive = await mk('Executive Leadership', 'Manager and General Managers private workspace');
  const allStaff = await mk('Company Workspace', 'All department announcements, updates and collaboration');

  await Contact.insertMany(users.flatMap(a => users.filter(b => b !== a).map(b => ({ owner: a._id, contact: b._id }))));

  const P = {
    viewMode: 'everyone',
    viewRoles: [],
    viewMembers: [],
    editRoles: [],
    editMembers: [],
    allowCopy: false,
    allowForward: false,
    allowDownload: false,
    allowReply: true,
    allowReact: true,
    allowScreenshot: true,
    screenshotProtected: false,
  };

  const mgr = id('manager');
  const gAll = allStaff._id;
  const gExec = executive._id;

  await Message.create([
    {
      groupId: gAll,
      senderId: mgr,
      content: 'Welcome to Connecta! A premium messaging platform with Brown, Beige & White design.',
      perm: { ...P, allowCopy: true, allowForward: true }
    },
    {
      groupId: gAll,
      senderId: mgr,
      content: 'GENERAL MANAGERS ONLY: Strategic planning summit at 2:00 PM.',
      perm: { ...P, viewMode: 'custom', viewRoles: ['General Manager'] }
    },
    {
      groupId: gAll,
      senderId: mgr,
      content: 'TEAM LEADERS ONLY: Sprint performance and KPI targets for this quarter.',
      perm: { ...P, viewMode: 'custom', viewRoles: ['Team Leader'] }
    },
    {
      groupId: gExec,
      senderId: mgr,
      content: 'CONFIDENTIAL: Q4 Financial projection & bonus allocations. (Screenshot Restricted, GM Alice can edit).',
      perm: {
        ...P,
        viewMode: 'custom',
        viewRoles: ['Manager', 'General Manager'],
        editMembers: [id('gm1')],
        allowScreenshot: false,
        screenshotProtected: true,
      }
    },
    {
      toUserId: by.gm1._id,
      senderId: mgr,
      content: 'Hi Alice, please review the revised role permission hierarchy when you get a chance.',
      perm: { ...P, allowCopy: true, allowForward: true, allowDownload: true }
    },
  ]);

  console.log('Seeded demo users (password: demo123), 2 groups, contacts and messages with screenshot controls');
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
