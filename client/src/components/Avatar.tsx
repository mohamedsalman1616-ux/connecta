import { useState } from 'react';

export function Avatar({
  name,
  src,
  size = 40,
  online,
}: {
  name: string;
  src?: string;
  size?: number;
  online?: boolean;
}) {
  const [bad, setBad] = useState(false);

  // Generate Royal Elegance purple / lavender / indigo hues from name
  const seed = [...(name || '?')].reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = 250 + (seed % 35); // 250 - 285: royal purple, violet, amethyst
  const sat = 52 + (seed % 22); // 52 - 74%
  const light1 = 52;
  const light2 = 38;

  return (
    <div className="relative shrink-0 select-none" style={{ width: size, height: size }}>
      {src && !bad ? (
        <img
          src={src}
          onError={() => setBad(true)}
          className="h-full w-full rounded-full object-cover ring-2 ring-border/40 shadow-sm"
          alt=""
          draggable={false}
        />
      ) : (
        <div
          className="grid h-full w-full place-items-center rounded-full font-display font-semibold text-white shadow-sm ring-1 ring-white/20"
          style={{
            background: `linear-gradient(135deg, hsl(${hue} ${sat}% ${light1}%), hsl(${(hue + 14) % 360} ${sat + 8}% ${light2}%))`,
            fontSize: size * 0.38,
          }}
        >
          {(name || '?').slice(0, 1).toUpperCase()}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-surface ${
            online ? 'bg-emerald-500' : 'bg-muted/40'
          }`}
          title={online ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
}
