import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-6xl font-bold text-gray-200">404</h1>
      <p className="text-xl font-semibold text-gray-700">頁面不存在</p>
      <p className="text-sm text-gray-500">
        您尋找的頁面可能已移除或網址有誤。
      </p>
      <Link
        href="/"
        className="mt-2 rounded-lg bg-[#E8820C] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        回到首頁
      </Link>
    </div>
  )
}
