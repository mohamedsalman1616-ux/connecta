import { useEffect, useRef, useState } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  Mic,
  Square,
  ShieldCheck,
  X,
  Timer,
  Lock,
} from 'lucide-react';
import { api, upload } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useChat } from '../store/chat';
import { useUI } from '../store/ui';
import { useAuth } from '../store/auth';
import {
  PermissionEditor,
  PermState,
  DEFAULT_PERM,
  isDefault,
  toApi,
  describe,
} from './PermissionEditor';

const EMOJI =
  '😀 😁 😂 🤣 😊 😍 😘 😎 🤔 😅 😭 😡 👍 👎 👏 🙌 🙏 💪 🔥 ✨ 🎉 ❤️ 💜 💙 💯 ✅ ❌ ⭐ 📚 📝 🎓 🏫 ⏰ 📢 🔒 👀 🤝 😴 🥳 😇 ☕ 💼 🛡️ 📸'.split(
    ' '
  );
const TIMERS: [string, number | undefined][] = [
  ['Off', undefined],
  ['10 sec', 10],
  ['1 min', 60],
  ['1 hour', 3600],
  ['1 day', 86400],
];

export function Composer({
  type,
  id,
  locked,
}: {
  type: 'group' | 'dm';
  id: string;
  locked?: string;
}) {
  const me = useAuth((s) => s.user)!;
  const { reply, setReply, members, loadChats } = useChat();
  const { toast } = useUI();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<{ key: string; name: string; mime: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [perm, setPerm] = useState<PermState>(DEFAULT_PERM);
  const [editor, setEditor] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [timer, setTimer] = useState<number | undefined>();
  const [timerMenu, setTimerMenu] = useState(false);
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const last = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText('');
    setFiles([]);
    setPerm(DEFAULT_PERM);
    setTimer(undefined);
  }, [type, id]);

  const onType = (v: string) => {
    setText(v);
    if (Date.now() - last.current > 1500) {
      last.current = Date.now();
      getSocket()?.emit(
        'typing',
        type === 'group' ? { groupId: id } : { toUserId: id }
      );
    }
  };

  const attach = async (f: Blob, name?: string) => {
    try {
      setBusy(true);
      const up = await upload(f, name);
      setFiles((x) => [...x, up]);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const startRec = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(s);
      const ch: Blob[] = [];
      r.ondataavailable = (e) => ch.push(e.data);
      r.onstop = () => {
        s.getTracks().forEach((t) => t.stop());
        const mime = r.mimeType.split(';')[0] || 'audio/webm';
        attach(
          new Blob(ch, { type: mime }),
          `voice-${Date.now()}.${mime.includes('ogg') ? 'ogg' : 'weba'}`
        );
      };
      r.start();
      setRec(r);
    } catch {
      toast(
        'Microphone access was blocked. Allow microphone in browser to record voice notes.',
        'error'
      );
    }
  };

  const send = async () => {
    if (busy || (!text.trim() && !files.length)) return;
    setBusy(true);
    try {
      await api(
        type === 'group' ? `/groups/${id}/messages` : `/dm/${id}/messages`,
        {
          body: {
            content: text,
            attachmentKeys: files.map((f) => f.key),
            replyTo: reply?._id,
            ...(type === 'group'
              ? { perm: toApi(perm) }
              : { disappearSeconds: timer }),
          },
        }
      );
      setText('');
      setFiles([]);
      setReply(null);
      setPerm(DEFAULT_PERM);
      setEmoji(false);
      loadChats();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (locked)
    return (
      <div className="glass m-3 flex items-center gap-2.5 rounded-2xl p-3.5 text-sm text-muted border border-border/80">
        <Lock size={16} className="text-accent" />
        {locked}
      </div>
    );

  return (
    <div className="relative p-3">
      {reply && (
        <div className="glass mb-2 flex items-center justify-between rounded-2xl border-l-4 border-accent px-3.5 py-2 text-xs">
          <span className="truncate text-muted">
            Replying to:{' '}
            <span className="text-ink font-medium">
              {reply.content.slice(0, 80) || 'attachment'}
            </span>
          </span>
          <button onClick={() => setReply(null)} aria-label="Cancel reply" className="p-1 hover:text-ink">
            <X size={15} />
          </button>
        </div>
      )}

      {type === 'group' && !isDefault(perm) && (
        <div className="mb-2 flex items-center justify-between rounded-xl bg-accent/15 border border-accent/30 px-3.5 py-1.5 text-xs text-ink">
          <span className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-accent" />
            <span className="font-medium">{describe(perm)}</span>
          </span>
          <button className="text-accent font-semibold hover:underline text-xs" onClick={() => setEditor(true)}>
            Edit Policy
          </button>
        </div>
      )}

      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((f) => (
            <span
              key={f.key}
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface-hover px-3 py-1 text-xs text-ink"
            >
              {f.name}
              <button onClick={() => setFiles(files.filter((x) => x !== f))} aria-label={`Remove ${f.name}`}>
                <X size={12} className="text-muted hover:text-ink" />
              </button>
            </span>
          ))}
        </div>
      )}

      {emoji && (
        <div className="glass absolute bottom-full left-3 z-30 mb-2 grid w-72 grid-cols-8 gap-1 rounded-2xl bg-surface/98 p-2.5 shadow-premium-lg border border-border">
          {EMOJI.map((e) => (
            <button
              key={e}
              className="rounded-lg p-1.5 text-xl hover:bg-surface-hover transition hover:scale-110"
              onClick={() => setText((t) => t + e)}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {timerMenu && (
        <div className="glass absolute bottom-full right-3 z-30 mb-2 rounded-2xl bg-surface/98 p-1.5 shadow-premium-lg border border-border">
          <p className="px-3 pb-1 pt-1.5 text-[11px] font-bold text-accent uppercase tracking-wider">
            Disappearing Messages
          </p>
          {TIMERS.map(([l, v]) => (
            <button
              key={l}
              className={`block w-full rounded-xl px-3.5 py-1.5 text-left text-xs hover:bg-surface-hover transition ${
                timer === v ? 'text-accent font-semibold bg-accent/10' : 'text-ink'
              }`}
              onClick={() => {
                setTimer(v);
                setTimerMenu(false);
              }}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      <div className="glass flex items-end gap-1.5 rounded-3xl p-1.5 shadow-sm border border-border">
        <button
          className="rounded-full p-2.5 text-muted hover:bg-surface-hover hover:text-ink transition"
          aria-label="Emoji"
          onClick={() => setEmoji(!emoji)}
        >
          <Smile size={19} />
        </button>

        <button
          className="rounded-full p-2.5 text-muted hover:bg-surface-hover hover:text-ink transition"
          aria-label="Attach file"
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip size={19} />
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) attach(f, f.name);
            e.target.value = '';
          }}
        />

        <textarea
          rows={1}
          value={text}
          onChange={(e) => onType(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type your message..."
          aria-label="Message"
          className="max-h-32 min-h-[38px] flex-1 resize-none bg-transparent px-2.5 py-2 outline-none text-ink text-sm placeholder:text-muted"
        />

        {type === 'group' && (
          <button
            className={`rounded-full p-2.5 transition ${
              isDefault(perm)
                ? 'text-muted hover:bg-surface-hover hover:text-ink'
                : 'btn-grad'
            }`}
            aria-label="Message Permissions & Screenshot Policy"
            title="Message Permissions & Screenshot Policy"
            onClick={() => setEditor(true)}
          >
            <ShieldCheck size={19} />
          </button>
        )}

        {type === 'dm' && (
          <button
            className={`rounded-full p-2.5 transition ${
              timer ? 'btn-grad' : 'text-muted hover:bg-surface-hover hover:text-ink'
            }`}
            aria-label="Disappearing messages"
            onClick={() => setTimerMenu(!timerMenu)}
          >
            <Timer size={19} />
          </button>
        )}

        {rec ? (
          <button
            className="rounded-full bg-rose-500 p-2.5 text-white animate-pulse"
            aria-label="Stop recording"
            onClick={() => {
              rec.stop();
              setRec(null);
            }}
          >
            <Square size={19} />
          </button>
        ) : (
          <button
            className="rounded-full p-2.5 text-muted hover:bg-surface-hover hover:text-ink transition"
            aria-label="Record voice note"
            onClick={startRec}
          >
            <Mic size={19} />
          </button>
        )}

        <button
          className="btn-grad rounded-full p-2.5 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Send"
          disabled={busy || (!text.trim() && !files.length)}
          onClick={send}
        >
          <Send size={19} />
        </button>
      </div>

      {editor && (
        <PermissionEditor
          initial={perm}
          members={members[id] ?? []}
          meId={me.id}
          onClose={() => setEditor(false)}
          onSave={(p) => {
            setPerm(p);
            setEditor(false);
            toast('Permissions & screenshot policy applied to this message', 'success');
          }}
        />
      )}
    </div>
  );
}
