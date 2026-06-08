import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { PageViewTracker } from '@/components/common/PageViewTracker'

export default function MemberLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      <PageViewTracker />
      <Header />
      {children}
      <Footer />
    </>
  )
}
