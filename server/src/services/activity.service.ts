import crypto from 'crypto';
import { Message, MessageActivity, User, GroupMember } from '../models';
import { io, room } from '../socket';

export type ActivityAction = 'VIEW' | 'EDIT' | 'FORWARD' | 'COPY' | 'DOWNLOAD' | 'REPLY' | 'REACT';

interface RecordParams {
  msg: any;
  userId: string;
  actionType: ActivityAction;
  destinationType?: 'group' | 'dm' | null;
  destinationId?: string | null;
  destinationName?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Records a validated, successful message activity event in MongoDB
 * and notifies the original sender in real time via Socket.IO.
 */
export async function recordActivity({
  msg,
  userId,
  actionType,
  destinationType = null,
  destinationId = null,
  destinationName = null,
  metadata = {},
}: RecordParams) {
  try {
    let targetMsgId = String(msg._id);
    let targetSenderId = String(msg.senderId);

    // For forwarded messages, trace FORWARD activity back to the original root message & sender
    if (actionType === 'FORWARD' && msg.originalMessageId) {
      const root: any = await Message.findById(msg.originalMessageId).select('senderId').lean();
      if (root) {
        targetMsgId = String(msg.originalMessageId);
        targetSenderId = String(root.senderId);
      }
    }

    // Do not record VIEW when the sender views their own message
    if (actionType === 'VIEW' && userId === targetSenderId) return null;

    // Deduplicate VIEW: preserve first viewed timestamp and update lastTimestamp
    if (actionType === 'VIEW') {
      const existing = await MessageActivity.findOne({
        originalMessageId: targetMsgId,
        performedByUserId: userId,
        actionType: 'VIEW',
      });
      if (existing) {
        existing.lastTimestamp = new Date();
        await existing.save();
        return existing.toObject();
      }
    }

    // Prevent duplicate records from rapid retries / double-clicks (3-second window)
    if (actionType === 'COPY' || actionType === 'DOWNLOAD' || actionType === 'REACT') {
      const recent = await MessageActivity.findOne({
        originalMessageId: targetMsgId,
        performedByUserId: userId,
        actionType,
        timestamp: { $gte: new Date(Date.now() - 3000) },
      }).lean();
      if (recent) return recent;
    }

    const user: any = await User.findById(userId)
      .select('username displayName role avatar')
      .lean();
    if (!user) return null;

    // Prefer group-specific role if message is in a group
    let effectiveRole = user.role || 'Staff';
    if (msg.groupId) {
      const gm: any = await GroupMember.findOne({ groupId: msg.groupId, userId })
        .select('role')
        .lean();
      if (gm?.role) effectiveRole = gm.role;
    }

    const now = new Date();
    const doc = await MessageActivity.create({
      activityId: crypto.randomUUID(),
      originalMessageId: targetMsgId,
      originalSenderId: targetSenderId,
      performedByUserId: userId,
      performedByUsername: user.username,
      performedByDisplayName: user.displayName || user.username,
      performedByRole: effectiveRole,
      actionType,
      timestamp: now,
      lastTimestamp: actionType === 'VIEW' ? now : undefined,
      destinationType,
      destinationId,
      destinationName,
      metadata,
    });

    const entry = { ...doc.toObject(), hasAvatar: !!user.avatar };

    // Notify ONLY the original sender in real time
    io.to(room(targetSenderId)).emit('activity:new', {
      messageId: targetMsgId,
      activity: entry,
    });

    return entry;
  } catch (err) {
    console.error('Failed to record message activity:', err);
    return null;
  }
}

/**
 * Retrieves the complete activity history & summary for a message.
 * Strictly restricted to the original message sender.
 */
export async function getMessageActivity(messageId: string, requesterId: string) {
  const msg: any = await Message.findById(messageId).lean();
  if (!msg) return { status: 404 as const, body: { error: 'Message not found' } };

  if (String(msg.senderId) !== requesterId) {
    return {
      status: 403 as const,
      body: { error: 'Only the original message sender can access message activity history' },
    };
  }

  const [sender, rawActivities] = await Promise.all([
    User.findById(msg.senderId).select('username displayName role').lean() as Promise<any>,
    MessageActivity.find({ originalMessageId: msg._id }).sort({ timestamp: -1 }).lean(),
  ]);

  const userIds = [...new Set(rawActivities.map((a: any) => a.performedByUserId))];
  const users = userIds.length
    ? ((await User.find({ _id: { $in: userIds } }).select('avatar').lean()) as any[])
    : [];
  const avatarMap = new Map(users.map((u) => [String(u._id), !!u.avatar]));

  const activities = rawActivities.map((a: any) => ({
    ...a,
    hasAvatar: avatarMap.get(a.performedByUserId) ?? false,
  }));

  const summary: Record<ActivityAction | 'total', number> = {
    VIEW: 0,
    EDIT: 0,
    FORWARD: 0,
    COPY: 0,
    DOWNLOAD: 0,
    REPLY: 0,
    REACT: 0,
    total: activities.length,
  };

  for (const a of activities) {
    const t = a.actionType as ActivityAction;
    if (t in summary) summary[t] += 1;
  }

  return {
    status: 200 as const,
    body: {
      message: {
        _id: String(msg._id),
        senderId: String(msg.senderId),
        senderName: sender?.displayName || sender?.username || 'Unknown',
        senderRole: sender?.role || 'Staff',
        createdAt: msg.createdAt,
        edited: !!msg.edited,
        perm: msg.perm ?? {},
      },
      summary,
      activities,
    },
  };
}

