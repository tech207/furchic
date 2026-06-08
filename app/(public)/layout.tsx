import type { Metadata } from 'next'
import Script from 'next/script'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://furchic.com'
const OG_IMAGE = `${SITE_URL}/og-image.jpg`

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Furchic — NFC 寵物智能卡',
    template: '%s | Furchic',
  },
  description:
    'Furchic 提供高質感 NFC 寵物智能卡，讓您的毛寶貝資訊隨掃即得，緊急時刻守護牠的安全。',
  keywords: [
    'NFC 寵物卡',
    '寵物智能卡',
    '寵物掛牌',
    'Furchic',
    '寵物安全',
    '毛孩守護',
  ],
  authors: [{ name: 'Furchic', url: SITE_URL }],
  creator: 'Furchic',
  openGraph: {
    type: 'website',
    locale: 'zh_TW',
    url: SITE_URL,
    siteName: 'Furchic',
    title: 'Furchic — NFC 寵物智能卡',
    description:
      '一張智能卡，守護你的毛寶貝。掃描即可獲取寵物完整資訊，緊急情況快速響應。',
    images: [
      { url: OG_IMAGE, width: 1200, height: 630, alt: 'Furchic NFC 寵物卡' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Furchic — NFC 寵物智能卡',
    description: '一張智能卡，守護你的毛寶貝。',
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  alternates: { canonical: SITE_URL },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Furchic',
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description: 'Furchic 提供 NFC 寵物智能卡服務，讓您的寵物資訊隨時可得。',
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+886-2-1234-5678',
    contactType: 'customer service',
    areaServed: 'TW',
    availableLanguage: 'zh-TW',
  },
  sameAs: ['https://instagram.com/furchic', 'https://facebook.com/furchic'],
}

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Script
        id="org-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  )
}
