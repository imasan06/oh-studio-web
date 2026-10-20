'use client';

import { useState, type FormEvent } from 'react';
import { site } from '@/content/site';
import type { Dictionary } from '@/i18n/dictionaries';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export default function ContactForm({ t }: { t: Dictionary['contact']['form'] }) {
  const [status, setStatus] = useState<Status>('idle');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') return <p className="flex items-center gap-3 rounded-[22px] bg-blanco/12 p-6 text-[22px]" role="status"><span className="num">✓</span>{t.sent}</p>;

  const field = 'w-full rounded-[16px] border border-marfil/40 bg-transparent px-5 py-4 text-[17px] text-blanco placeholder:text-marfil/70 focus:border-verde focus:outline-none';
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sr-only" htmlFor="c-name">{t.name}</label>
        <input id="c-name" name="name" required autoComplete="name" placeholder={t.name} className={field} />
        <label className="sr-only" htmlFor="c-email">{t.email}</label>
        <input id="c-email" name="email" type="email" required autoComplete="email" placeholder={t.email} className={field} />
      </div>
      <label className="sr-only" htmlFor="c-msg">{t.message}</label>
      <textarea id="c-msg" name="message" required rows={4} placeholder={t.message} className={`${field} resize-none`} />
      {/* honeypot: bots fill it, people don't see it */}
      <input name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={status === 'sending'} className="pill bg-blanco px-8 py-4 text-[17px] text-azul hover:bg-verde hover:text-noche disabled:opacity-60">
          {status === 'sending' ? t.sending : t.send}<span className="punta text-[13px] -rotate-90" />
        </button>
        {status === 'error' && <p role="alert" className="text-[15px]">{t.error} <a className="underline" href={`mailto:${site.email}`}>{site.email}</a></p>}
      </div>
    </form>
  );
}
