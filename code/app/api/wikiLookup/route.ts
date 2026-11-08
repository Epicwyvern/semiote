import { NextResponse } from 'next/server'
import { lookupWikipedia, validSymbolName } from '@/lib/symbol-research'
export async function POST(request: Request) {
  try {
    const { symbolName } = await request.json()
    if (!validSymbolName(symbolName)) return NextResponse.json({ error: 'A symbol name of 1-120 characters is required' }, { status: 400 })
    const result = await lookupWikipedia(symbolName.trim())
    return NextResponse.json({ ...result, success: result.sources.length > 0,
      title: result.sources[0]?.title,
      info: result.sources.map(source => `${source.title}\n${source.excerpt}\n${source.url}`).join('\n\n') || 'No Wikipedia evidence available',
    })
  } catch { return NextResponse.json({ error: 'Invalid lookup request' }, { status: 400 }) }
}
