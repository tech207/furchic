import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Pet.chic Weekend',
    template: '%s | Pet.chic Weekend',
  },
  description: 'Pet.chic Weekend pet NFC card and shopping experience.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  )
}
