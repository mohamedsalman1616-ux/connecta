import { Router } from 'express';
import { z } from 'zod';
import { CustomRole, User, GroupMember } from '../models';
import { requireAuth } from '../middleware/auth';

const r = Router();

// Standard default roles
export const DEFAULT_ROLES = [
  {
    name: 'Manager',
    description: 'Full organization and role management permissions',
    isSystem: true,
    permissions: {
      canManageRoles: true,
      canCreateGroups: true,
      canDeleteAnyMessage: true,
      canPinMessages: true,
      canAnnounce: true,
      canInvite: true,
    }
  },
  {
    name: 'General Manager',
    description: 'Senior management with elevated moderation permissions',
    isSystem: true,
    permissions: {
      canManageRoles: false,
      canCreateGroups: true,
      canDeleteAnyMessage: true,
      canPinMessages: true,
      canAnnounce: true,
      canInvite: true,
    }
  },
  {
    name: 'Team Leader',
    description: 'Team lead with group moderation & pinning capabilities',
    isSystem: true,
    permissions: {
      canManageRoles: false,
      canCreateGroups: true,
      canDeleteAnyMessage: false,
      canPinMessages: true,
      canAnnounce: true,
      canInvite: true,
    }
  },
  {
    name: 'Staff',
    description: 'Standard member with messaging and group collaboration access',
    isSystem: true,
    permissions: {
      canManageRoles: false,
      canCreateGroups: true,
      canDeleteAnyMessage: false,
      canPinMessages: false,
      canAnnounce: false,
      canInvite: true,
    }
  }
];

// Safe migration helper: preserves accounts and safely updates legacy roles
export async function migrateLegacyRoles() {
  try {
    // 1. Ensure default system roles exist
    for (const def of DEFAULT_ROLES) {
      await CustomRole.findOneAndUpdate(
        { name: def.name },
        { $setOnInsert: def },
        { upsert: true }
      );
    }

    // 2. Safely migrate legacy roles in User collection
    await User.updateMany(
      { role: { $in: ['Headmaster', 'Webmaster', 'webmaster', 'headmaster', 'admin'] } },
      { $set: { role: 'Manager' } }
    );
    await User.updateMany(
      { role: { $in: ['Student', 'student'] } },
      { $set: { role: 'Staff' } }
    );

    // 3. Safely migrate legacy roles in GroupMember collection
    await GroupMember.updateMany(
      { role: { $in: ['Headmaster', 'Webmaster', 'webmaster', 'headmaster', 'admin'] } },
      { $set: { role: 'Manager' } }
    );
    await GroupMember.updateMany(
      { role: { $in: ['Student', 'student'] } },
      { $set: { role: 'Staff' } }
    );
  } catch (err) {
    console.error('Role migration error:', err);
  }
}

// Middleware: ensure caller is an authorized administrator (Manager or has canManageRoles)
export async function requireRoleManager(req: any, res: any, next: any) {
  if (req.user?.role === 'Manager') return next();
  const roleDoc: any = await CustomRole.findOne({ name: req.user?.role }).lean();
  if (roleDoc?.permissions?.canManageRoles) return next();
  return res.status(403).json({ error: 'Unauthorized: Only Managers can manage roles' });
}

// GET /api/roles: List all roles
r.get('/roles', requireAuth, async (_req, res) => {
  await migrateLegacyRoles();
  const roles = await CustomRole.find().sort({ isSystem: -1, createdAt: 1 }).lean();
  res.json(roles);
});

// POST /api/roles: Create a custom role (Manager only)
const roleSchema = z.object({
  name: z.string().trim().min(2).max(30).regex(/^[a-zA-Z0-9_\- ]+$/, 'Role name can only contain letters, numbers, spaces, and hyphens'),
  description: z.string().max(200).optional().default(''),
  permissions: z.object({
    canManageRoles: z.boolean().default(false),
    canCreateGroups: z.boolean().default(true),
    canDeleteAnyMessage: z.boolean().default(false),
    canPinMessages: z.boolean().default(false),
    canAnnounce: z.boolean().default(false),
    canInvite: z.boolean().default(true),
  }).default({}),
});

r.post('/roles', requireAuth, requireRoleManager, async (req: any, res) => {
  const p = roleSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message ?? 'Invalid role data' });

  const existing = await CustomRole.findOne({ name: { $regex: new RegExp(`^${p.data.name}$`, 'i') } });
  if (existing) return res.status(409).json({ error: 'Role with this name already exists' });

  const role = await CustomRole.create({
    name: p.data.name.trim(),
    description: p.data.description,
    isSystem: false,
    permissions: p.data.permissions,
  });

  res.status(201).json(role);
});

// PATCH /api/roles/:id: Rename role or update permissions (Manager only)
r.patch('/roles/:id', requireAuth, requireRoleManager, async (req: any, res) => {
  const targetRole: any = await CustomRole.findById(req.params.id);
  if (!targetRole) return res.status(404).json({ error: 'Role not found' });

  const updateSchema = z.object({
    name: z.string().trim().min(2).max(30).optional(),
    description: z.string().max(200).optional(),
    permissions: z.object({
      canManageRoles: z.boolean().optional(),
      canCreateGroups: z.boolean().optional(),
      canDeleteAnyMessage: z.boolean().optional(),
      canPinMessages: z.boolean().optional(),
      canAnnounce: z.boolean().optional(),
      canInvite: z.boolean().optional(),
    }).partial().optional(),
  });

  const p = updateSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Invalid update data' });

  const oldName = targetRole.name;

  if (p.data.name && p.data.name !== oldName) {
    if (targetRole.isSystem && targetRole.name === 'Manager') {
      return res.status(400).json({ error: 'Cannot rename the root Manager role' });
    }
    const duplicate = await CustomRole.findOne({ _id: { $ne: targetRole._id }, name: { $regex: new RegExp(`^${p.data.name}$`, 'i') } });
    if (duplicate) return res.status(409).json({ error: 'Another role already has this name' });

    targetRole.name = p.data.name.trim();
    // Synchronize user and group member records holding the old role name
    await User.updateMany({ role: oldName }, { $set: { role: targetRole.name } });
    await GroupMember.updateMany({ role: oldName }, { $set: { role: targetRole.name } });
  }

  if (p.data.description !== undefined) {
    targetRole.description = p.data.description;
  }

  if (p.data.permissions) {
    targetRole.permissions = { ...(targetRole.permissions ?? {}), ...p.data.permissions };
    // Manager role must always retain canManageRoles
    if (targetRole.name === 'Manager') {
      targetRole.permissions.canManageRoles = true;
    }
  }

  await targetRole.save();
  res.json(targetRole);
});

// DELETE /api/roles/:id: Delete custom role (Manager only; system roles protected)
r.delete('/roles/:id', requireAuth, requireRoleManager, async (req: any, res) => {
  const targetRole: any = await CustomRole.findById(req.params.id);
  if (!targetRole) return res.status(404).json({ error: 'Role not found' });
  if (targetRole.isSystem) return res.status(400).json({ error: 'System roles (Manager, General Manager, Team Leader, Staff) cannot be deleted' });

  const deletedName = targetRole.name;
  await CustomRole.deleteOne({ _id: targetRole._id });

  // Migrate any users/members who held this deleted role to Staff
  await User.updateMany({ role: deletedName }, { $set: { role: 'Staff' } });
  await GroupMember.updateMany({ role: deletedName }, { $set: { role: 'Staff' } });

  res.json({ ok: true, migratedTo: 'Staff' });
});

// GET /api/users/all: List users for role administration (Manager only)
r.get('/users/all', requireAuth, requireRoleManager, async (_req, res) => {
  const users = await User.find().select('username displayName role status avatar createdAt').sort({ username: 1 }).lean();
  res.json(users.map(u => ({ id: String(u._id), username: u.username, displayName: u.displayName, role: u.role, status: u.status, hasAvatar: !!u.avatar })));
});

// PATCH /api/users/:id/role: Assign role to user (Manager only)
r.patch('/users/:id/role', requireAuth, requireRoleManager, async (req: any, res) => {
  const { role } = req.body ?? {};
  if (!role || typeof role !== 'string') return res.status(400).json({ error: 'Role name required' });

  const roleExists = await CustomRole.exists({ name: role.trim() });
  if (!roleExists) return res.status(400).json({ error: 'Role does not exist' });

  const targetUser: any = await User.findById(req.params.id);
  if (!targetUser) return res.status(404).json({ error: 'User not found' });

  // Prevent demoting the last manager
  if (targetUser.role === 'Manager' && role !== 'Manager') {
    const managerCount = await User.countDocuments({ role: 'Manager' });
    if (managerCount <= 1) return res.status(400).json({ error: 'Cannot reassign the last remaining Manager' });
  }

  targetUser.role = role.trim();
  targetUser.tokenVersion = (targetUser.tokenVersion ?? 0) + 1; // refresh user session to apply role immediately
  await targetUser.save();

  // Also update group memberships
  await GroupMember.updateMany({ userId: targetUser._id }, { $set: { role: targetUser.role } });

  res.json({ ok: true, userId: String(targetUser._id), role: targetUser.role });
});

export default r;

