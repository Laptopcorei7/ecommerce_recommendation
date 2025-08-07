import type React from "react"
import type { Metadata } from "next"
import { Inter } from 'next/font/google'
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "ElectroHub - Premium Electronics & Technology Store",
  description:
    "Discover the latest electronics, smartphones, laptops, gaming gear, and smart home devices. Premium tech products with competitive prices and fast shipping at ElectroHub.",
  keywords: "electronics, smartphones, laptops, gaming, smart home, tech gadgets, Apple, Samsung, Sony",
  authors: [{ name: "ElectroHub Team" }],
  openGraph: {
    title: "ElectroHub - Premium Electronics & Technology Store",
    description: "Discover the latest electronics and tech gadgets with competitive prices and fast shipping.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "ElectroHub - Premium Electronics & Technology Store",
    description: "Discover the latest electronics and tech gadgets with competitive prices and fast shipping.",
  },
  robots: {
    index: true,
    follow: true,
  },
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
