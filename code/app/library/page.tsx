import Link from "next/link"

export default function LibraryPage() {
  // Sample symbols for the library
  const symbols = [
    {
      id: 1,
      name: "Triquetra",
      category: "Celtic",
      description:
        "A three-cornered shape composed of three interlaced arcs. It represents the triple nature of the Goddess as maiden, mother, and crone.",
      image: "/Triquetra Circle.svg",
    },
    {
      id: 2,
      name: "Ankh",
      category: "Egyptian",
      description:
        "An ancient Egyptian hieroglyphic symbol that was most commonly used to represent the word for 'life' and, by extension, as a symbol of life itself.",
      image: "/placeholder.svg",
    },
    {
      id: 3,
      name: "Ouroboros",
      category: "Ancient",
      description:
        "An ancient symbol depicting a serpent or dragon eating its own tail, representing the eternal cycle of destruction and rebirth.",
      image: "/placeholder.svg",
    },
    {
      id: 4,
      name: "Eye of Horus",
      category: "Egyptian",
      description:
        "An ancient Egyptian symbol of protection, royal power, and good health. The eye is personified in the goddess Wadjet.",
      image: "/placeholder.svg",
    },
    {
      id: 5,
      name: "Tree of Life",
      category: "Various",
      description:
        "A mystical symbol connecting all forms of creation, representing the interconnectedness of all life on our planet.",
      image: "/placeholder.svg",
    },
    {
      id: 6,
      name: "Pentagram",
      category: "Various",
      description:
        "A five-pointed star that has been used as a symbol throughout history in various religions and cultures.",
      image: "/placeholder.svg",
    },
    {
      id: 7,
      name: "Sun Cross",
      category: "Alchemy",
      description:
        "An ancient symbol representing the sun's cycles and the four seasons.",
      image: "/placeholder.svg",
    },
    {
      id: 8,
      name: "Peace Symbol",
      category: "Modern",
      description:
        "A modern symbol representing peace, created in the 1950s.",
      image: "/placeholder.svg",
    },
    {
      id: 9,
      name: "Aquarius",
      category: "Astrology",
      description:
        "The zodiac sign representing those born between January 20 and February 18.",
      image: "/placeholder.svg",
    },
    {
      id: 10,
      name: "Cancer",
      category: "Astrology",
      description:
        "The zodiac sign representing those born between June 21 and July 22.",
      image: "/placeholder.svg",
    },
    {
      id: 11,
      name: "Taurus",
      category: "Astrology",
      description:
        "The zodiac sign representing those born between April 20 and May 20.",
      image: "/placeholder.svg",
    },
    {
      id: 12,
      name: "Skull and Crossbones",
      category: "Alchemy",
      description:
        "A symbol of danger and death, often used as a warning.",
      image: "/placeholder.svg",
    },
  ];

  // Category counts
  const categories = [
    { name: "All Items", count: symbols.length },
    { name: "Alchemy", count: symbols.filter(s => s.category === "Alchemy").length },
    { name: "Architecture", count: 2 },
    { name: "Astrology", count: symbols.filter(s => s.category === "Astrology").length },
    { name: "Culture", count: 17 },
    { name: "Miscellaneous", count: 9 },
    { name: "Modern", count: symbols.filter(s => s.category === "Modern").length },
    { name: "Mythology", count: 21 },
    { name: "Occult", count: 10 },
    { name: "Philosophy", count: 1 },
    { name: "Religion", count: 29 },
    { name: "Science", count: 18 },
    { name: "Societies", count: 14 },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Filter Sidebar */}
      <aside className="w-64 border-r border-ash-grey/10 p-6 shrink-0">
        <h3 className="font-garamond text-lg mb-4">Filter By</h3>
        
        <ul className="space-y-2">
          {categories.map(category => (
            <li key={category.name} className="flex justify-between items-center">
              <span className="text-sm hover:text-gold-leaf cursor-pointer transition-colors">{category.name}</span>
              <span className="text-xs text-ash-grey">{category.count}</span>
            </li>
          ))}
        </ul>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        {/* Search */}
        <div className="mb-8 max-w-md">
          <div className="relative">
            <input
              type="text"
              placeholder="Search symbols..."
              className="w-full py-2 px-4 pr-10 rounded-md bg-bone-white border border-ash-grey/20 text-obsidian-black placeholder-ash-grey focus:outline-none focus:ring-1 focus:ring-gold-leaf"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 absolute right-3 top-1/2 transform -translate-y-1/2 text-ash-grey"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Symbol Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8">
          {symbols.map((symbol) => (
            <Link 
              key={symbol.id} 
              href={`/library/symbol/${symbol.id}`}
              className="group flex flex-col items-center"
            >
              <div className="h-36 w-36 bg-parchment/20 rounded-md flex items-center justify-center mb-2 group-hover:bg-parchment/50 transition-colors">
                <img
                  src={symbol.image}
                  alt={symbol.name}
                  className="w-16 h-16 object-contain"
                />
              </div>
              <h3 className="font-garamond text-center">{symbol.name}</h3>
              <span className="text-xs text-ash-grey lowercase">{symbol.category}</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
