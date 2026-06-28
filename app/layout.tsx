import type { Metadata } from 'next'
import { Spectral, Hanken_Grotesk } from 'next/font/google'
import './globals.css'

const spectral = Spectral({
  variable: '--font-spectral',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
})

const hanken = Hanken_Grotesk({
  variable: '--font-hanken',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Augur — find out how often you’re actually right when you feel sure',
  description:
    'A personal calibration trainer. Answer verifiable questions with a confidence level and watch your calibration curve form. When you say 90%, how often are you right?',
  metadataBase: new URL('https://augur.dhruvsa1.org'),
  openGraph: {
    title: 'Augur — a star-chart of your own certainty',
    description:
      'Make predictions with a confidence level; Augur scores you with Brier scores and a calibration curve.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${spectral.variable} ${hanken.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
