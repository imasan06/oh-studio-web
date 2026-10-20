'use client';

import { useEffect, useRef } from 'react';
import { cityLife } from '@/lib/life/cityLife';
import { stage } from '@/lib/stage';

/** The fixed canvas behind every page. Pages drive it through `stage`. */
export default function StageView() {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const tint = useRef<HTMLDivElement>(null);

  useEffect(() => stage.attach(root.current!, canvas.current!, tint.current!), []);
  // cars, people and traffic lights, drawn live over the frames
  useEffect(() => {
    cityLife.load().then(() => stage.setLive(cityLife));
    return () => stage.setLive(null);
  }, []);

  return (
    // behind the frames: the renders' own ground colour, so nothing shows at their edges
    <div ref={root} aria-hidden className="stage fixed inset-0 z-0 overflow-hidden bg-[#F4F5F2]">
      <canvas ref={canvas} width={1920} height={1080} className="stage-canvas absolute inset-0 h-full w-full" />
      <div ref={tint} className="pointer-events-none absolute inset-0 bg-noche opacity-0" />
    </div>
  );
}
