import type { Metadata } from 'next';
import './globals.css';
import { Nav } from '@/components/Nav';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://videamax.com'),
  title: {
    default: 'Videamax — property tour videos from your listing photos',
    template: '%s · Videamax',
  },
  description:
    'Upload your listing photos and get a narrated property tour video. Rooms classified automatically, ' +
    'one cinematic shot per room, voiceover and captions, rendered in your browser.',
  openGraph: {
    title: 'Videamax — property tour videos from your listing photos',
    description: 'One cinematic shot per room, narrated and captioned. Pay per video with credits, or bring your own API keys.',
    url: 'https://videamax.com',
    siteName: 'Videamax',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="relative z-10">
          <Nav />
          {children}
          <footer className="mt-24 border-t border-line/70">
            <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-mist">
              <div className="flex flex-wrap items-start justify-between gap-8">
                <div className="max-w-sm">
                  <div className="font-display text-lg text-chalk">Videamax</div>
                  <p className="mt-2 leading-relaxed">
                    Property tour videos from listing photos. Your photos stay in your browser —
                    only the shots you choose to animate are ever sent to a model.
                  </p>
                </div>
                <div className="flex gap-12">
                  <div>
                    <div className="mb-2 text-xs uppercase tracking-wider text-mist/60">Product</div>
                    <ul className="space-y-1.5">
                      <li><a className="hover:text-chalk" href="/studio">Studio</a></li>
                      <li><a className="hover:text-chalk" href="/pricing">Pricing</a></li>
                      <li><a className="hover:text-chalk" href="/credits">Credits</a></li>
                      <li><a className="hover:text-chalk" href="/settings">API keys</a></li>
                    </ul>
                  </div>
                  <div>
                    <div className="mb-2 text-xs uppercase tracking-wider text-mist/60">Agencies</div>
                    <ul className="space-y-1.5">
                      <li>
                        <a className="text-gold hover:text-chalk" href="https://nexibeo.com" target="_blank" rel="noreferrer">
                          nexibeo.com
                        </a>
                      </li>
                      <li className="max-w-[16rem] text-xs leading-relaxed text-mist/80">
                        Want this built into your agency&apos;s own systems, with your branding and
                        your listing feed? Nexibeo builds the custom version.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-6 text-xs text-mist/70">
                <span>© {new Date().getFullYear()} Videamax</span>
                <span>You must own or represent every listing you make a video of.</span>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
