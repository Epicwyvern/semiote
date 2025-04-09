"use client"

import { useState } from "react"
import Link from "next/link"
import { Home, Library, Info, Menu, Search, FileSymlink, BookOpen, PenTool, ChevronLeft, ChevronRight } from "lucide-react"

// Sample conversation history data
const conversations = [
  {
    period: "Today",
    items: [
      { title: "Omen Landing Page Copy", href: "#" },
      { title: "Historical Symbols Like M", href: "#" },
      { title: "Icon Set Recommendations", href: "#" },
    ],
  },
  {
    period: "Yesterday",
    items: [
      { title: "Logo Analysis for Semiote", href: "#" },
      { title: "Brand Slogan Ideas", href: "#" },
    ],
  },
  {
    period: "Previous 7 Days",
    items: [
      { title: "AI for Artifact Categorization", href: "#" },
      { title: "Literary Work Representation", href: "#" },
      { title: "SQL vs NoSQL vs GraphDB", href: "#" },
      { title: "IMEI Format Issue", href: "#" },
      { title: "Creative Struggle Poem", href: "#" },
    ],
  },
  {
    period: "Previous 30 Days",
    items: [
      { title: "Risk Assessment Matrix", href: "#" },
      { title: "Silent Signal Communication", href: "#" },
      { title: "Nature of Literary Language", href: "#" },
      { title: "Wilde and Hamlet Allusion", href: "#" },
      { title: "Mentor Student Role Reversal", href: "#" },
      { title: "Alternate Reality Names", href: "#" },
      { title: "Sir Gawain and 5", href: "#" },
      { title: "All-in-One Astrophotography", href: "#" },
      { title: "History of Declension", href: "#" },
      { title: "Convert webp to png", href: "#" },
      { title: "Triquetra and Symbol Inquiry", href: "#" },
    ],
  },
]

export function Sidebar() {
  const [expanded, setExpanded] = useState(false)

  const toggleSidebar = () => {
    setExpanded(!expanded)
  }
  
  // Function to close sidebar
  const handleNavClick = () => {
    if (expanded) {
      setExpanded(false)
    }
  }

  return (
    <>
      {/* Main sidebar - always visible */}
      <aside className="h-screen bg-bone-white border-r border-ash-grey/10 flex flex-col w-[80px] fixed z-50">
        {/* Logo section */}
        <div className="h-[72px] p-4 flex justify-center items-center border-b border-ash-grey/10">
          <Link href="/">
            <img 
              src="/Triquetra Circle.svg"
              alt="Triquetra logo"
              className="h-12 w-12"
            />
          </Link>
        </div>

        {/* Toggle button in middle */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2">
          <button onClick={toggleSidebar} className="p-2 rounded-md hover:bg-parchment/50 transition-colors mx-auto flex">
            <div className="flex items-center">
              <Menu size={18} />
              {expanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </div>
          </button>
        </div>
      </aside>

      {/* Second pane - slides out */}
      <aside 
        className={`h-screen bg-bone-white border-r border-ash-grey/10 fixed left-[80px] top-0 w-[250px] transition-transform duration-300 z-40 flex flex-col ${
          expanded ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header section */}
        <div className="h-[72px] p-4 border-b border-ash-grey/10 flex items-center shrink-0">
          <div className="flex items-center">
            <img 
              src="/Wordmark No.svg"
              alt="Semiote"
              className="h-8"
            />
          </div>
        </div>

        {/* Navigation */}
        <div className="p-2 border-b border-ash-grey/10 shrink-0">
          <nav className="space-y-1">
            <Link href="/" className="flex items-center p-3 rounded-md hover:bg-parchment/50 transition-colors" onClick={handleNavClick}>
              <Home size={18} className="shrink-0" />
              <span className="ml-3 truncate font-garamond">Home</span>
            </Link>

            <Link href="/tools/discern" className="flex items-center p-3 rounded-md hover:bg-parchment/50 transition-colors" onClick={handleNavClick}>
              <FileSymlink size={18} className="shrink-0" />
              <span className="ml-3 truncate font-garamond">Discern</span>
            </Link>

            <Link href="/tools/decipher" className="flex items-center p-3 rounded-md hover:bg-parchment/50 transition-colors" onClick={handleNavClick}>
              <BookOpen size={18} className="shrink-0" />
              <span className="ml-3 truncate font-garamond">Decipher</span>
            </Link>

            <Link href="/tools/define" className="flex items-center p-3 rounded-md hover:bg-parchment/50 transition-colors" onClick={handleNavClick}>
              <PenTool size={18} className="shrink-0" />
              <span className="ml-3 truncate font-garamond">Define</span>
            </Link>

            <Link
              href="/library"
              className="flex items-center p-3 rounded-md hover:bg-parchment/50 transition-colors"
              onClick={handleNavClick}
            >
              <Library size={18} className="shrink-0" />
              <span className="ml-3 truncate font-garamond">Library</span>
            </Link>

            <Link href="/about" className="flex items-center p-3 rounded-md hover:bg-parchment/50 transition-colors" onClick={handleNavClick}>
              <Info size={18} className="shrink-0" />
              <span className="ml-3 truncate font-garamond">About</span>
            </Link>
          </nav>
        </div>

        {/* Conversation History - Scrollable */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="h-full overflow-y-auto">
            <div className="p-2">
              {conversations.map((period) => (
                <div key={period.period} className="mb-4">
                  <h3 className="text-xs font-medium text-ash-grey px-3 py-2 font-garamond">{period.period}</h3>
                  <ul className="space-y-1">
                    {period.items.map((item) => (
                      <li key={item.title}>
                        <Link
                          href={item.href}
                          className="flex items-center p-3 rounded-md hover:bg-parchment/50 transition-colors text-sm"
                          onClick={handleNavClick}
                        >
                          <span className="ml-3 truncate">{item.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
