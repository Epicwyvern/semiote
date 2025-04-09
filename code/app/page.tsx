import Link from "next/link"
import { SpinningMandala } from "../components/spinning-mandala"
import { FileSymlink, BookOpen, PenTool } from "lucide-react"

export default function Home() {
  return (
    <div className="relative min-h-screen bg-bone-white">
      <div className="pl-12 pr-8 py-16 relative z-1">
        <div className="text-left">
          <div className="mb-10 -ml-4">
            <img
              src="/Semiote Name Logo Transparent.png"
              alt="Semiote"
              className="h-48"
            />
          </div>
          <h1 className="mb-6 text-6xl">
            <span className="block">This is <span className="text-gold-leaf">Omen.</span></span>
          </h1>
          <p className="text-lg mb-8 max-w-3xl">
            Symbols are everywhere—etched in stone, whispered in dreams, or scattered across history like echoes gone
            unheard. Yet we rarely stop to ask what they mean or what they are trying to tell us.
          </p>

          <p className="text-lg mb-8 max-w-3xl">
            Omen, the first prototype for Semiote, is here to{" "}
            <span className="text-gold-leaf">Let the Symbols Speak</span>. Find specific symbols within images via the{" "}
            <Link href="/tools/discern" className="text-gold-leaf hover:underline">
              Discern
            </Link>{" "}
            Tool, understand what they mean via the{" "}
            <Link href="/tools/decipher" className="text-gold-leaf hover:underline">
              Decipher
            </Link>{" "}
            Tool, or define your own symbols and archive them in your library via the{" "}
            <Link href="/tools/define" className="text-gold-leaf hover:underline">
              Define
            </Link>{" "}
            Tool.
          </p>

          <p className="text-lg mb-8">Get started with our tools:</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
            <Link 
              href="/tools/discern" 
              className="border border-ash-grey/30 rounded-lg p-6 bg-parchment/10 hover:bg-parchment/30 transition-colors group"
            >
              <div className="flex items-center mb-4 text-gold-leaf">
                <FileSymlink size={24} className="mr-2" />
                <h3 className="text-xl font-garamond">Discern</h3>
              </div>
              <p className="text-ash-grey group-hover:text-obsidian-black transition-colors">
                Upload images and identify symbols within them. Our tool will help you locate and recognize symbolic elements.
              </p>
            </Link>

            <Link 
              href="/tools/decipher" 
              className="border border-ash-grey/30 rounded-lg p-6 bg-parchment/10 hover:bg-parchment/30 transition-colors group"
            >
              <div className="flex items-center mb-4 text-gold-leaf">
                <BookOpen size={24} className="mr-2" />
                <h3 className="text-xl font-garamond">Decipher</h3>
              </div>
              <p className="text-ash-grey group-hover:text-obsidian-black transition-colors">
                Understand the meaning behind symbols across cultures and time periods with our comprehensive knowledge base.
              </p>
            </Link>

            <Link 
              href="/tools/define" 
              className="border border-ash-grey/30 rounded-lg p-6 bg-parchment/10 hover:bg-parchment/30 transition-colors group"
            >
              <div className="flex items-center mb-4 text-gold-leaf">
                <PenTool size={24} className="mr-2" />
                <h3 className="text-xl font-garamond">Define</h3>
              </div>
              <p className="text-ash-grey group-hover:text-obsidian-black transition-colors">
                Create and archive your own symbolic interpretations, building a personal library of Semiotes.
              </p>
            </Link>
          </div>
        </div>
      </div>
      <SpinningMandala />
    </div>
  )
}
