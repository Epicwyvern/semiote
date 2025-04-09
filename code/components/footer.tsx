import Link from "next/link"

export function Footer() {
  return (
    <footer className="bg-obsidian-black text-bone-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-garamond text-xl mb-4">Semiote</h3>
            <p className="text-moonlit-silver mb-4">
              A platform for the analysis, interpretation, and definition of symbols.
            </p>
            <div className="flex space-x-4 mt-4">
              <svg width="24" height="24" viewBox="0 0 1250 1250" className="h-6 w-6 fill-gold-leaf">
                <path d="M627,127c-74.79,60.92-126.27,141.26-147.51,235.89-8.01,35.71-15.66,89.45-11.47,125.44.56,4.79,2.87,20.69,8.63,21.26l48.23-12.88,1.09-62.38c5.94-68.98,27.86-140.78,72.07-194.85,9.42-11.52,20.52-21.58,29.95-33.08,1.72-1.12,2.96.97,4.05,2.05,13.42,13.3,28.86,31.76,39.79,47.19,10.92,15.42,18.97,33.05,32.64,46.34,18.02,2.93,35.04,11.67,52.73,15.26,2.24.46,7.98,2.72,8.74.05,1.39-4.92-14.14-35.98-17.4-42.37-28.74-56.24-68.61-107.95-117.52-147.92h419v730.69l-10.08-42.4c-30.31-112.69-103.88-201.93-204.25-259.64-5.29-3.04-27.37-16.11-31.61-16.43-2.62-.2-4.09,8.01-4.77,10.39-4.11,14.34-6.66,29.25-10.39,43.71l.75,1.59c23.88,14.34,48.14,28.32,69.83,45.91,46.76,37.92,94.11,96.47,114.27,153.66,1.98,5.61,9.63,29.07,7.75,33.2-1.76,3.86-12.11,6.64-16.29,7.73-25.14,6.59-51.75,6.35-77.16,10.83-11.33,12.95-23.83,24.85-35.56,37.42-3.15,3.37-8.43,8.67-10.99,12-.77,1-1.94,1.27-1.49,3,23.79-.61,47.75.81,71.54.05,35.21-1.14,71.48-5.35,105.23-15.77,11.46-3.54,24.05-7.49,33.23-15.26v88.96h-414c78.08-3.39,148.36-32.76,206.01-85.45,40.73-37.22,68.87-82.98,88.85-134.2l-.35-2.2c-10.36-11.74-19.41-25.63-30-37.06-1.91-2.06-7.47-8.46-9.97-8.03s-14.63,40.69-16.79,46.28c-29.25,75.57-102.81,139.63-180.75,161.18-32.43,8.96-108.44,9.8-140.76.77-15.08-4.21-29.64-11.78-44.74-16.13-20.58,6.41-40.7,14.66-62.36,17-3.69,5.95,10.41,14.11,14.55,16.66,39.62,24.35,96.34,39.09,142.31,41.18H200v-95.96c1.04,1.26,1.24,2.8,2.6,3.9,3.76,3,27.82,9.06,34.18,10.81,99.99,27.63,179.54,25.23,276.47-11.96,25.67-9.85,65.67-27.26,87.08-43.9,2.43-1.89,7.61-5.25,7.59-8.33-.04-7.72-30.51-33.2-36.56-40.38-76.47,48.36-173.16,80.09-264.39,62.41-9.6-1.86-23.94-5.23-32.65-9.34-8.04-3.8-5.57-7.82-3.8-15.17,2.86-11.91,10.05-28.45,15.02-39.96,3.22-7.46,10.57-18.9,12.7-25.28,2.24-6.71-3.24-16.26-5.15-23.31-4.32-15.93-6.54-36.82-11.62-51.41-.6-1.72-.07-2.41-2.45-1.98-31.23,49.1-60.01,100.55-73.71,157.74l-5.31,28.18V127h427Z" />
              </svg>
            </div>
          </div>

          <div>
            <h3 className="font-garamond text-xl mb-4">Navigation</h3>
            <nav className="flex flex-col space-y-2">
              <Link href="/" className="text-moonlit-silver hover:text-gold-leaf transition-colors">
                Home
              </Link>
              <Link href="/library" className="text-moonlit-silver hover:text-gold-leaf transition-colors">
                Library
              </Link>
              <Link href="/about" className="text-moonlit-silver hover:text-gold-leaf transition-colors">
                About
              </Link>
              <Link href="/contact" className="text-moonlit-silver hover:text-gold-leaf transition-colors">
                Contact
              </Link>
            </nav>
          </div>

          <div>
            <h3 className="font-garamond text-xl mb-4">Tools</h3>
            <nav className="flex flex-col space-y-2">
              <Link href="/tools/discern" className="text-moonlit-silver hover:text-gold-leaf transition-colors">
                Discern Tool
              </Link>
              <Link href="/tools/decipher" className="text-moonlit-silver hover:text-gold-leaf transition-colors">
                Decipher Tool
              </Link>
              <Link href="/tools/define" className="text-moonlit-silver hover:text-gold-leaf transition-colors">
                Define Tool
              </Link>
            </nav>
          </div>
        </div>

        <div className="border-t border-ash-grey/20 mt-8 pt-8 text-center text-moonlit-silver">
          <p>&copy; {new Date().getFullYear()} Semiote. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
