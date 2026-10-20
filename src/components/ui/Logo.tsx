import Image from 'next/image';
import type { ReactNode } from 'react';

// The OH ESTUDIO logo, from the brand kit's files (public/brand, see scripts/brand-assets.ts). It is
// never redrawn, recoloured outside the palette, stretched or given effects (Manual · Usos incorrectos).
// Versions: horizontal for headers (min. 100 px wide), principal for covers, symbol for small spaces.
const FILES = {
  horizontal: { azul: '/brand/logo-horizontal-azul.png', marfil: '/brand/logo-horizontal-marfil.png', ratio: 315 / 132 },
  principal: { azul: '/brand/logo-principal-blanco.png', marfil: '/brand/logo-principal-blanco.png', ratio: 387 / 480 },
  simbolo: { azul: '/brand/simbolo-azul.png', marfil: '/brand/simbolo-blanco.png', ratio: 157 / 192 },
};

type Props = { version?: keyof typeof FILES; tone?: 'azul' | 'marfil'; height: number; className?: string; priority?: boolean; alt?: string };

export function Logo({ version = 'horizontal', tone = 'azul', height, className, priority, alt = 'OH ESTUDIO' }: Props) {
  const f = FILES[version];
  return <Image src={f[tone]} alt={alt} width={Math.round(height * f.ratio)} height={height} className={className} priority={priority} unoptimized />;
}

/** A headline with its highlighted words: "Espacio *habitable*" → Inter Bold + Krub Italic (Manual · Jerarquía tipográfica).
 *  `mark` swaps the italic for another treatment, e.g. a softer colour in the same weight. */
export function rich(text: string, mark = 'accent'): ReactNode {
  return text.split(/(\*[^*]+\*)/).map((part, i) =>
    part.startsWith('*') && part.endsWith('*') ? <span key={i} className={mark}>{part.slice(1, -1)}</span> : part,
  );
}
/** The same text without the markers, for attributes and metadata. */
export const plain = (text: string) => text.replace(/\*/g, '');
