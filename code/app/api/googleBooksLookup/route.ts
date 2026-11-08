import { NextResponse } from 'next/server'
import { lookupBooks, validSymbolName } from '@/lib/symbol-research'
export async function POST(request: Request) {
  try {
    const { symbolName } = await request.json()
    if (!validSymbolName(symbolName)) return NextResponse.json({ error: 'A symbol name of 1-120 characters is required' }, { status: 400 })
    const result = await lookupBooks(symbolName.trim())
    return NextResponse.json({ ...result, success: result.sources.length > 0,
      title: result.sources[0]?.title,
      bookData: result.sources.map(source => `${source.title}\n${source.excerpt}\n${source.url}`).join('\n\n') || 'No book evidence available',
    })
  } catch { return NextResponse.json({ error: 'Invalid lookup request' }, { status: 400 }) }
}
