export interface Can {
  view: boolean;
  edit: boolean;
  copy: boolean;
  forward: boolean;
  download: boolean;
  reply: boolean;
  react: boolean;
  restricted: boolean;
  allowScreenshot: boolean;
  screenshotProtected: boolean;
}

export interface Att { name: string; type: string; href: string; canDownload: boolean }

export interface Msg {
  _id: string;
  groupId?: string;
  toUserId?: string;
  senderId: string;
  content: string;
  attachments: Att[];
  can: Can;
  perm: any;
  reactions: { userId: string; emoji: string }[];
  replyTo?: string;
  forwarded?: boolean;
  edited?: boolean;
  pinned?: boolean;
  starred?: boolean;
  readBy?: string[];
  deliveredTo?: string[];
  createdAt: string;
}

export interface Member {
  userId: string;
  username: string;
  displayName: string;
  online: boolean;
  lastSeen?: string;
  role: string;
  admin: 'none' | 'coadmin' | 'admin';
}

export interface RolePermissions {
  canManageRoles: boolean;
  canCreateGroups: boolean;
  canDeleteAnyMessage: boolean;
  canPinMessages: boolean;
  canAnnounce: boolean;
  canInvite: boolean;
}

export interface CustomRole {
  _id?: string;
  name: string;
  description?: string;
  isSystem?: boolean;
  permissions: RolePermissions;
  createdAt?: string;
}

export interface Me {
  id: string;
  username: string;
  displayName: string;
  role: string;
  bio: string;
  status: string;
  settings: any;
}

export interface Notif {
  _id?: string;
  id?: string;
  text: string;
  read?: boolean;
  createdAt: string;
  data?: any;
}

export interface Chat {
  type: 'group' | 'dm';
  id: string;
  name: string;
  username?: string;
  hasPhoto?: boolean;
  online?: boolean;
  lastSeen?: string;
  unread: number;
  updatedAt: string;
  last: { content: string; hasFile: boolean; senderId: string; createdAt: string } | null;
}

export type ActivityAction = 'VIEW' | 'EDIT' | 'FORWARD' | 'COPY' | 'DOWNLOAD' | 'REPLY' | 'REACT';

export interface MessageActivityEntry {
  activityId: string;
  originalMessageId: string;
  originalSenderId: string;
  performedByUserId: string;
  performedByUsername: string;
  performedByDisplayName: string;
  performedByRole: string;
  hasAvatar?: boolean;
  actionType: ActivityAction;
  timestamp: string;
  lastTimestamp?: string;
  destinationType?: 'group' | 'dm' | null;
  destinationId?: string | null;
  destinationName?: string | null;
  metadata?: Record<string, any>;
}

export interface MessageActivityResponse {
  message: {
    _id: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    createdAt: string;
    edited?: boolean;
    perm?: any;
  };
  summary: Record<ActivityAction | 'total', number>;
  activities: MessageActivityEntry[];
}

export const ckey = (type: 'group' | 'dm', id: string) => `${type === 'group' ? 'g' : 'd'}:${id}`;
