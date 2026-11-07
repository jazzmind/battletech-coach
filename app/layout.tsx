import type { Metadata, Viewport } from "next"
import { Atkinson_Hyperlegible, Russo_One } from "next/font/google"
import "./globals.css"

const display = Russo_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
})

const body = Atkinson_Hyperlegible({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-body",
})

export const metadata: Metadata = {
  title: "Table Coach",
  description: "A shared turn coach for Alpha Strike at the kitchen table.",
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: "#16211e",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  )
}
