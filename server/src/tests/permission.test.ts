import { describe, it, expect } from 'vitest';
import { canView, canEdit, abilities, projectForViewer } from '../services/permission.service';
const base = {
  viewMode: 'everyone' as const,
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
const msg = (perm: any = {}) => ({ _id: '1', senderId: 'mgr', content: 'secret', attachments: [{ name: 'a.pdf', mime: 'application/pdf', key: 'abc.pdf' }], perm: { ...base, ...perm } });
const mgr = { id: 'mgr', role: 'Manager' }, gm = { id: 'gm1', role: 'General Manager' }, staff = { id: 's1', role: 'Staff' };

describe('message access control & screenshot protection', () => {
  it('gm-only hides from general staff entirely', () => {
    const m = msg({ viewMode: 'custom', viewRoles: ['General Manager'] });
    expect(canView(m, gm)).toBe(true);
    expect(canView(m, staff)).toBe(false);
    expect(projectForViewer(m, staff)).toBeNull();
  });
  it('individual member visibility', () => {
    const m = msg({ viewMode: 'custom', viewMembers: ['s1'] });
    expect(canView(m, staff)).toBe(true);
    expect(canView(m, gm)).toBe(false);
  });
  it('view-only cannot copy/forward/download/edit', () => {
    expect(abilities(msg(), staff)).toMatchObject({ view: true, edit: false, copy: false, forward: false, download: false });
    const a = projectForViewer(msg(), staff).attachments[0];
    expect(a.key).toBeUndefined();
    expect(a.canDownload).toBe(false);
    expect(a.href).toContain('/files/0');
  });
  it('editor gets edit + copy + forward + download, and implies view', () => {
    const m = msg({ viewMode: 'custom', editMembers: ['gm1'] });
    expect(abilities(m, gm)).toMatchObject({ view: true, edit: true, copy: true, forward: true, download: true });
  });
  it('screenshot protection toggles correctly', () => {
    const unprotected = abilities(msg(), staff);
    expect(unprotected.allowScreenshot).toBe(true);
    expect(unprotected.screenshotProtected).toBe(false);

    const protectedMsg = abilities(msg({ allowScreenshot: false, screenshotProtected: true }), staff);
    expect(protectedMsg.allowScreenshot).toBe(false);
    expect(protectedMsg.screenshotProtected).toBe(true);
  });
  it('expired messages vanish for everyone but the sender', () => {
    const m = msg({ expiresAt: new Date(Date.now() - 1000) });
    expect(canView(m, staff)).toBe(false);
    expect(canView(m, mgr)).toBe(true);
  });
  it('does not leak audience lists to non-senders', () => {
    const m = msg({ viewMode: 'custom', viewRoles: ['General Manager'], editMembers: ['gm1'] });
    expect(projectForViewer(m, gm).perm.viewRoles).toBeUndefined();
    expect(canEdit(m, staff)).toBe(false);
  });
});
