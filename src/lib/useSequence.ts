'use client';

import { useEffect, useState } from 'react';
import type { FrameSequence } from './renders/frames';
import type { RenderManifest, Tier } from './renders/manifest';
import { currentTier, getSequence, loadManifest } from './renders/registry';

export type LoadedSequence = { seq: FrameSequence; tier: Tier; manifest: RenderManifest; dims: { w: number; h: number } };

/** Loads a sequence for the current screen orientation; swaps it if the device rotates. */
export function useSequence(key: string | null): LoadedSequence | null {
  const [state, setState] = useState<LoadedSequence | null>(null);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    const mq = window.matchMedia('(max-aspect-ratio: 1/1)');
    const load = async () => {
      const tier = currentTier();
      const [manifest, seq] = await Promise.all([loadManifest(), getSequence(key, tier)]);
      if (alive) setState({ seq, tier, manifest, dims: manifest.tiers[tier] });
    };
    load().catch(err => console.warn('[sequence]', err));
    mq.addEventListener('change', load);
    return () => { alive = false; mq.removeEventListener('change', load); };
  }, [key]);

  return state;
}
