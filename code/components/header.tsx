import Link from "next/link"
import { User } from "lucide-react"

export function Header() {
  return (
    <header className="border-b border-ash-grey/10 h-[72px] flex items-center px-6">
      <div className="flex justify-end items-center space-x-8 w-full">
        <Link href="/" className="font-garamond text-lg hover:text-gold-leaf transition-colors">
          Home
        </Link>
        <Link href="/tools/discern" className="font-garamond text-lg hover:text-gold-leaf transition-colors">
          Discern
        </Link>
        <Link href="/tools/decipher" className="font-garamond text-lg hover:text-gold-leaf transition-colors">
          Decipher
        </Link>
        <Link href="/tools/define" className="font-garamond text-lg hover:text-gold-leaf transition-colors">
          Define
        </Link>
        <Link href="/library" className="font-garamond text-lg hover:text-gold-leaf transition-colors">
          Library
        </Link>
        <Link href="/about" className="font-garamond text-lg hover:text-gold-leaf transition-colors">
          About
        </Link>
        <button className="p-2 rounded-full hover:bg-parchment/50 transition-colors">
          <User className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}
