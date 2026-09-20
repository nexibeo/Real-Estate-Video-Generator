'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const LINKS = [
  { href: '/studio', label: 'Studio' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/credits', label: 'Credits' },
  { href: '/settings', label: 'Keys' },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-ink/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-gold text-[13px] font-bold text-ink">V</span>
          <span className="font-display text-lg tracking-tight text-chalk">Videamax</span>
        </Link>
        <div className="flex items-center gap-1">
          {LINKS.map((l) => {
            const active = path === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active ? 'bg-ink-3 text-chalk' : 'text-mist hover:text-chalk'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <Link
            href="/studio"
            className="ml-2 rounded-md bg-gold px-3.5 py-1.5 text-sm font-medium text-ink transition-opacity hover:opacity-90"
          >
            Make a video
          </Link>
        </div>
      </nav>
    </header>
  );
}
