import Link from 'next/link';
import { rich } from '@/components/ui/Logo';

// Bilingual on purpose: a not-found page doesn't know which language the visitor wanted.
export default function NotFound() {
  return (
    <section className="relative flex min-h-svh flex-col items-start justify-center gap-8 overflow-hidden bg-azul px-4 text-blanco md:px-12">
      {/* the brand pattern, for large backgrounds */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.14]" style={{ backgroundImage: 'url(/brand/patron-azul.png)', backgroundSize: '520px' }} />
      <p className="label relative text-marfil/80">404</p>
      <h1 className="bar relative max-w-[12ch] text-[clamp(52px,8vw,140px)] font-bold leading-[0.98] tracking-[-0.035em]">{rich('Esta calle *no existe*')}</h1>
      <p className="accent relative text-[22px] text-marfil/85">This street doesn’t exist.</p>
      <Link href="/" className="pill relative bg-blanco px-7 py-4 text-[16px] text-azul hover:bg-verde hover:text-noche">
        <span className="punta rotate-90 text-[13px]" />Volver a la ciudad · Back to the city
      </Link>
    </section>
  );
}
