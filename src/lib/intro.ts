// Shared timing between the opening curtain and the hero's own entrance animation.

export const INTRO_KEY = 'oh-intro-played';

let endsAt = 0;
/** Where the curtain opens from (viewport px); the home hero sets it to the O's centre. */
export const introOrigin = { x: -1, y: -1 };

export const markIntro = (ms: number) => { endsAt = performance.now() + ms; };
/** Seconds until the curtain has cleared (0 if it isn't playing). */
export const introRemaining = () => Math.max(0, (endsAt - performance.now()) / 1000);
