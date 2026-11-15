import { Inter } from 'next/font/google';
import './globals.css';

// Inter, self-hosted by next/font at build (no external font host in the output).
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
});

const SITE = 'https://arepapay.site';
const DESC =
  'ArepaPay es una app de pagos y banca para Venezuela sobre su propia red Avalanche permisada (red de pruebas). ' +
  'En desarrollo: pagos a comercios con precios en bolívares, saldos cifrados, KYC y una banca con respaldo real.';

export const metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: 'ArepaPay — pagos y banca sobre una red propia',
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
    title: 'ArepaPay — pagos y banca sobre una red propia',
    description: DESC,
    images: [{ url: '/brand/arepapay-logo.png', width: 1024, height: 1024, alt: 'ArepaPay' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@ArepaPay',
    creator: '@ArepaPay',
    title: 'ArepaPay — pagos y banca sobre una red propia',
    description: DESC,
    images: ['/brand/arepapay-logo.png'],
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
