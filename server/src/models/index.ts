import { Schema, model } from 'mongoose';
const oid = Schema.Types.ObjectId;

export const CustomRole = model('CustomRole', new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: '' },
  isSystem: { type: Boolean, default: false },
  permissions: {
    canManageRoles: { type: Boolean, default: false },
    canCreateGroups: { type: Boolean, default: true },
    canDeleteAnyMessage: { type: Boolean, default: false },
    canPinMessages: { type: Boolean, default: false },
    canAnnounce: { type: Boolean, default: false },
    canInvite: { type: Boolean, default: true },
  }
}, { timestamps: true }));

export const User = model('User', new Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9_]{3,20}$/ },
  passwordHash: { type: String, required: true }, displayName: String, bio: { type: String, default: '' },
  status: { type: String, default: 'Hey there! I am using Connecta' }, avatar: String, // avatar = stored file key
  role: { type: String, default: 'Staff' }, // Manager | General Manager | Team Leader | Staff | custom roles
  online: { type: Boolean, default: false }, lastSeen: Date,
  blocked: [{ type: oid, ref: 'User' }], tokenVersion: { type: Number, default: 0 }, // bump to revoke all sessions
  settings: { type: Schema.Types.Mixed, default: {} },       // theme, font size, sounds, notification prefs, wallpapers
}, { timestamps: true }));

export const Group = model('Group', new Schema({
  name: { type: String, required: true }, description: { type: String, default: '' }, photo: String,
  createdBy: { type: oid, ref: 'User' }, inviteCode: { type: String, index: true }, announcementsOnly: { type: Boolean, default: false },
}, { timestamps: true }));

export const GroupMember = model('GroupMember', new Schema({
  groupId: { type: oid, ref: 'Group', index: true }, userId: { type: oid, ref: 'User', index: true },
  admin: { type: String, enum: ['none', 'coadmin', 'admin'], default: 'none' }, role: { type: String, default: 'Staff' },
}, { timestamps: true }).index({ groupId: 1, userId: 1 }, { unique: true }));

export const Contact = model('Contact', new Schema({
  owner: { type: oid, ref: 'User' }, contact: { type: oid, ref: 'User' },
}, { timestamps: true }).index({ owner: 1, contact: 1 }, { unique: true }));

export const Notification = model('Notification', new Schema({
  userId: { type: oid, index: true }, type: String, text: String, data: Schema.Types.Mixed, read: { type: Boolean, default: false },
}, { timestamps: true }));

export const Story = model('Story', new Schema({
  userId: { type: oid, ref: 'User', index: true }, text: { type: String, maxlength: 300 }, bg: String, mediaKey: String, mediaMime: String,
  expiresAt: { type: Date, required: true, index: { expires: 0 } }, // Mongo TTL removes it at expiry
  viewers: [{ _id: false, userId: oid, at: Date }],
}, { timestamps: true }));

export const Report = model('Report', new Schema({
  reporterId: String, type: { type: String, enum: ['user', 'message'] }, targetId: String, reason: String, snapshot: Schema.Types.Mixed, status: { type: String, default: 'open' },
}, { timestamps: true }));

export const Upload = model('Upload', new Schema({
  key: { type: String, unique: true }, owner: { type: oid, index: true }, name: String, mime: String, size: Number,
}, { timestamps: true }));

const permSchema = new Schema({
  viewMode: { type: String, enum: ['everyone', 'custom'], default: 'everyone' },
  viewRoles: [String], viewMembers: [String], editRoles: [String], editMembers: [String],
  allowCopy: { type: Boolean, default: false }, allowForward: { type: Boolean, default: false }, allowDownload: { type: Boolean, default: false },
  allowReply: { type: Boolean, default: true }, allowReact: { type: Boolean, default: true },
  allowScreenshot: { type: Boolean, default: true }, screenshotProtected: { type: Boolean, default: false },
  expiresAt: Date,
}, { _id: false });

// Permissions are embedded (not a separate collection) so a message and its ACL are saved and read atomically.
export const Message = model('Message', new Schema({
  groupId: { type: oid, index: true }, toUserId: { type: oid }, senderId: { type: String, required: true },
  content: { type: String, maxlength: 4000, default: '' },
  attachments: [{ _id: false, name: String, mime: String, key: String }],
  perm: { type: permSchema, default: () => ({}) },
  replyTo: oid, originalMessageId: { type: oid, index: true },
  forwarded: Boolean, edited: Boolean, deleted: Boolean, pinned: Boolean, disappear: Boolean,
  reactions: [{ _id: false, userId: String, emoji: String }], starredBy: [String], deliveredTo: [String], readBy: [String], reports: [String],
}, { timestamps: true }).index({ groupId: 1, createdAt: -1 }).index({ toUserId: 1, senderId: 1, createdAt: -1 }));

export const MessageActivity = model('MessageActivity', new Schema({
  activityId: { type: String, required: true, unique: true },
  originalMessageId: { type: oid, required: true, index: true },
  originalSenderId: { type: String, required: true, index: true },
  performedByUserId: { type: String, required: true },
  performedByUsername: { type: String, required: true },
  performedByDisplayName: { type: String, default: '' },
  performedByRole: { type: String, default: 'Staff' },
  actionType: {
    type: String,
    enum: ['VIEW', 'EDIT', 'FORWARD', 'COPY', 'DOWNLOAD', 'REPLY', 'REACT'],
    required: true,
  },
  timestamp: { type: Date, default: Date.now },
  lastTimestamp: { type: Date },
  destinationType: { type: String, enum: ['group', 'dm', null], default: null },
  destinationId: { type: String, default: null },
  destinationName: { type: String, default: null },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true })
  .index({ originalMessageId: 1, actionType: 1, timestamp: -1 })
  .index({ originalMessageId: 1, performedByUserId: 1, actionType: 1 })
  .index({ originalSenderId: 1, timestamp: -1 }));
