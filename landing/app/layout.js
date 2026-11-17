import { Inter } from 'next/font/google';
import './globals.css';

// Inter, self-hosted by next/font at build (no external font host in the output).
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
});

// Canonical origin. Default = the user's domain. A sub-path host (GitHub Pages) sets
// NEXT_PUBLIC_SITE_URL=https://<user>.github.io together with NEXT_BASE_PATH=/<repo> (D-024),
// so OG/Twitter/canonical URLs point at the host that actually serves the files.
const ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || 'https://arepapay.site').replace(/\/+$/, '');
const BP = process.env.NEXT_PUBLIC_BASE_PATH || '';
const SITE = ORIGIN + BP + '/';
const OG_IMG = 'brand/arepapay-logo.png'; // relative to SITE (metadataBase), which already carries BP
const TITLE = 'ArepaPay — la cadena bancaria privada para micro y pequeños comercios';
const DESC =
  'ArepaPay: pagos con QR para micro y pequeños comercios en Venezuela, en una red privada de Avalanche. ' +
  'MVP en la red de pruebas Fuji, con dinero de prueba. Sin token especulativo.';

export const metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: TITLE,
    template: '%s · ArepaPay',
  },
  description: DESC,
  applicationName: 'ArepaPay',
  keywords: ['ArepaPay', 'Venezuela', 'pagos', 'USDT', 'bolívares', 'Avalanche', 'red de pruebas', 'testnet'],
  alternates: { canonical: SITE },
  openGraph: {
    type: 'website',
    locale: 'es_VE',
    url: SITE,
    siteName: 'ArepaPay',
    title: TITLE,
    description: DESC,
    images: [{ url: OG_IMG, width: 1024, height: 1024, alt: 'ArepaPay' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@ArepaPay',
    creator: '@ArepaPay',
    title: TITLE,
    description: DESC,
    images: [OG_IMG],
  },
  robots: { index: true, follow: true },
  category: 'finance',
};

export const viewport = {
  themeColor: '#1A2472',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
