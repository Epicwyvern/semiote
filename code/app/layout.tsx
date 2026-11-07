import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { Header } from "../components/header"
import { Sidebar } from "../components/sidebar"

export const metadata: Metadata = {
  title: "Semiote | Symbol Analysis & Interpretation",
  description: "Analyze, interpret, and archive symbols from across history and cultures.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600;700&family=Lato:wght@300;400;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body className="bg-bone-white text-obsidian-black font-lato">
        <div className="flex h-[100dvh] overflow-hidden bg-bone-white">
          <Sidebar />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bone-white ml-[80px]">
            <Header />
            <main className="relative min-h-0 flex-1 overflow-hidden bg-bone-white">{children}</main>
          </div>
        </div>
      </body>
    </html>
  )
}
