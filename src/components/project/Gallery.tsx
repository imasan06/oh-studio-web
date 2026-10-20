'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { GalleryItem, Locale } from '@/content/projects';
import { RenderArt } from '../ui/RenderArt';

function Media({ item, alt, sizes, priority }: { item: GalleryItem; alt: string; sizes: string; priority?: boolean }) {
  if ('src' in item) return <Image src={item.src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />;
  return <RenderArt i={item.art} className="absolute inset-0" />;
}

export default function Gallery({ items, lang, label }: { items: GalleryItem[]; lang: Locale; label: string }) {
  const [sel, setSel] = useState(0);
  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <figure className="relative aspect-[16/10] overflow-hidden rounded-[22px] bg-gris">
        {items.map((it, i) => (
          <div key={i} className={`absolute inset-0 transition-opacity duration-500 ${i === sel ? 'opacity-100' : 'opacity-0'}`} aria-hidden={i !== sel}>
            <Media item={it} alt={it.caption[lang]} sizes="(min-width: 1024px) 60vw, 100vw" priority={i === 0} />
          </div>
        ))}
        <figcaption className="pill label absolute bottom-4 left-4 bg-noche py-1.5 pl-1.5 pr-4 text-[11px] text-marfil">
          <span className="num text-[10px]">{sel + 1}.</span>{items[sel].caption[lang]}
        </figcaption>
      </figure>
      <div className="grid grid-cols-4 gap-3 md:gap-5" role="group" aria-label={label}>
        {items.map((it, i) => (
          <button key={i} type="button" onClick={() => setSel(i)} aria-pressed={i === sel} aria-label={it.caption[lang]}
            className={`relative aspect-[16/10] overflow-hidden rounded-[14px] bg-gris transition-[opacity,box-shadow] duration-300 ${i === sel ? 'opacity-100 shadow-[0_0_0_3px_#123BFF]' : 'opacity-55 hover:opacity-85'}`}>
            <Media item={it} alt="" sizes="20vw" />
          </button>
        ))}
      </div>
    </div>
  );
}
