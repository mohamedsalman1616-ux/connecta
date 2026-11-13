// Pure functions: the single source of truth for Module 4. No DB access, easy to unit test.
export interface Viewer { id: string; role: string }
export interface MessagePerm {
  viewMode: 'everyone' | 'custom';      // custom = union of viewRoles + viewMembers
  viewRoles: string[]; viewMembers: string[];
  editRoles: string[]; editMembers: string[];
  allowCopy: boolean; allowForward: boolean; allowDownload: boolean;
  allowReply: boolean; allowReact: boolean;
  allowScreenshot?: boolean; screenshotProtected?: boolean;
  expiresAt?: Date | null;
}
export interface MsgLike { _id: any; senderId: string; content: string; attachments?: any[]; perm: MessagePerm; [k: string]: any }

const expired = (p: MessagePerm, now: Date) => !!p.expiresAt && new Date(p.expiresAt).getTime() <= now.getTime();
export const isSender = (m: { senderId: string }, v: Viewer) => m.senderId === v.id;

export function canEdit(m: MsgLike, v: Viewer, now = new Date()): boolean {
  if (isSender(m, v)) return true;
  if (expired(m.perm, now)) return false;
  return m.perm.editMembers.includes(v.id) || m.perm.editRoles.includes(v.role);
}
export function canView(m: MsgLike, v: Viewer, now = new Date()): boolean {
  if (isSender(m, v)) return true;
  if (expired(m.perm, now)) return false;
  if (canEdit(m, v, now)) return true; // editors can always view
  const p = m.perm;
  if (p.viewMode === 'everyone') return true;
  return p.viewMembers.includes(v.id) || p.viewRoles.includes(v.role);
}
export interface Abilities {
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
export function abilities(m: MsgLike, v: Viewer, now = new Date()): Abilities {
  const view = canView(m, v, now), edit = view && canEdit(m, v, now);
  const screenshotAllowed = view && (edit || (m.perm.allowScreenshot !== false && !m.perm.screenshotProtected));
  const isProtected = view && (m.perm.screenshotProtected === true || m.perm.allowScreenshot === false);

  return {
    view, edit,
    copy: view && (edit || m.perm.allowCopy),
    forward: view && (edit || m.perm.allowForward),
    download: view && (edit || m.perm.allowDownload),
    reply: view && m.perm.allowReply,
    react: view && m.perm.allowReact,
    restricted: view && !edit && !(m.perm.allowCopy && m.perm.allowForward && m.perm.allowDownload),
    allowScreenshot: screenshotAllowed,
    screenshotProtected: isProtected,
  };
}
/** Returns null when viewer may not see the message: no content and no existence leaks. */
export function projectForViewer(m: MsgLike, v: Viewer, now = new Date()) {
  const can = abilities(m, v, now);
  if (!can.view) return null;
  const { perm, ...rest } = m as any;
  const safe: any = { ...rest, can };
  // Storage keys never leave the server; files are streamed through an authorized route.
  safe.attachments = (m.attachments ?? []).map((a: any, i: number) => ({ name: a.name, type: a.mime ?? a.type, href: `/api/messages/${m._id}/files/${i}`, canDownload: can.download }));
  safe.perm = isSender(m, v) ? perm : {
    viewMode: perm.viewMode,
    allowCopy: perm.allowCopy,
    allowScreenshot: perm.allowScreenshot,
    screenshotProtected: perm.screenshotProtected,
    expiresAt: perm.expiresAt
  }; // no audience lists
  return safe;
}
