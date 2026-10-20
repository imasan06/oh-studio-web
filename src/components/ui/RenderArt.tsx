import type { CSSProperties } from 'react';

// Flat illustrations, placeholders for real project photos, in the brand palette
// (marfil, azul noche, azul grisáceo, azul vívido).
const C = { bg: '#F0EDE7', ink: '#232A5B', line: '#C7D1DD', mid: '#123BFF', soft: '#C7D1DD', grey: '#C7D1DD', dark: '#123BFF' };
export const ART_BG = [C.bg, C.ink, C.line, C.ink, C.bg, C.dark];

const ab = (s: CSSProperties): CSSProperties => ({ position: 'absolute', ...s });
const Ground = ({ c }: { c: string }) => <div style={ab({ left: '8%', right: '8%', bottom: '14%', height: '2.5%', minHeight: 2, background: c })} />;

function Shapes({ i }: { i: number }) {
  switch (i) {
    case 0: return (<>
      <div style={ab({ right: '14%', top: '10%', width: '24%', aspectRatio: '1', borderRadius: '50%', background: C.soft })} />
      <div style={ab({ left: '24%', width: '44%', bottom: '14%', height: '58%', border: `3px solid ${C.ink}`, boxSizing: 'border-box', background: C.bg })} />
      <div style={ab({ left: '50%', width: '9%', top: '36%', height: '18%', background: C.mid })} />
      <Ground c={C.ink} /></>);
    case 1: return (<>
      <div style={ab({ left: '32%', width: '36%', top: '12%', aspectRatio: '1', borderRadius: '50%', background: C.soft })} />
      <div style={ab({ left: '26%', width: '48%', top: '30%', bottom: '10%', border: `4px solid ${C.grey}`, borderBottom: 'none', borderRadius: '999px 999px 0 0', boxSizing: 'border-box' })} /></>);
    case 2: return (<>
      <div style={ab({ left: '30%', width: '30%', top: '18%', bottom: '14%', background: C.ink })} />
      <div style={ab({ left: '36%', width: '7%', top: '26%', height: '14%', background: C.soft })} />
      <div style={ab({ left: '47%', width: '7%', top: '26%', height: '14%', background: C.bg })} />
      <div style={ab({ left: '60%', width: '22%', top: '46%', bottom: '14%', background: C.bg })} />
      <Ground c={C.ink} /></>);
    case 3: return (
      <div style={ab({ left: '18%', right: '18%', top: '16%', bottom: '16%', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8%' })}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map(q => <div key={q} style={{ background: q === 3 ? C.grey : q === 5 ? C.soft : C.bg }} />)}
      </div>);
    case 4: return (<>
      <div style={ab({ left: '14%', width: '22%', top: '38%', bottom: '14%', background: C.mid, borderRadius: '999px 999px 0 0' })} />
      <div style={ab({ left: '40%', width: '22%', top: '18%', bottom: '14%', background: C.ink, borderRadius: '999px 999px 0 0' })} />
      <div style={ab({ left: '66%', width: '12%', top: '54%', bottom: '14%', background: C.soft, borderRadius: '999px 999px 0 0' })} />
      <Ground c={C.ink} /></>);
    default: return (<>
      <div style={ab({ left: '12%', width: '18%', top: '14%', aspectRatio: '1', border: `3px solid ${C.bg}`, boxSizing: 'border-box' })} />
      <div style={ab({ right: '16%', width: '24%', top: '16%', aspectRatio: '1', borderRadius: '50%', background: C.soft })} />
      <div style={ab({ left: '12%', right: '12%', top: '64%', height: 2, background: C.bg })} />
      <div style={ab({ left: '12%', width: '42%', top: '76%', height: 2, background: C.bg })} /></>);
  }
}

export function RenderArt({ i, className = '', style }: { i: number; className?: string; style?: CSSProperties }) {
  return (
    <div className={`${/\b(absolute|fixed)\b/.test(className) ? '' : 'relative'} overflow-hidden ${className}`} style={{ background: ART_BG[i % 6], ...style }} aria-hidden>
      <Shapes i={i % 6} />
    </div>
  );
}
