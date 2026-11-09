export type ResearchSource = {
  id: string; title: string; url: string; excerpt: string
  authors?: string[]; publishedYear?: string
  kind: 'wikipedia' | 'book' | 'web'; candidateName: string; candidateNames?: string[]; aliases?: string[]; imageUrl?: string
}
export type ResearchResult = { sources: ResearchSource[]; status: 'available' | 'unavailable' | 'no_results'; failureCode?: string }
export const normalizedName = (value: string) => value.normalize('NFKC').toLowerCase().replace(/['’]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
export function relevantTitle(query: string, title: string) {
  const key = normalizedName(query.replace(/\([^)]*\)/g, ' '))
  const target = normalizedName(title)
  const core = key.split(' ').filter(word => !['or', 'and', 'the', 'a', 'design', 'symbol', 'quadruple', 'radiant', 'glowing'].includes(word))
  return core.length > 0 && core.every(word => target.includes(word) || (word === 'pointed' && target.includes('point')))
}

const entities: Record<string, string> = {
  amp: '&', quot: '"', apos: "'", nbsp: ' ', lt: '<', gt: '>',
  ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
}
export function cleanSourceText(value: unknown, length = 4000) {
  if (typeof value !== 'string') return ''
  return value.replace(/<[^>]*>/g, ' ').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, token: string) => {
    if (!token.startsWith('#')) {
      const decoded = entities[token.toLowerCase()]
      return typeof decoded === 'string' ? decoded : match
    }
    const hex = token[1]?.toLowerCase() === 'x'
    const point = parseInt(token.slice(hex ? 2 : 1), hex ? 16 : 10)
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : match
  }).replace(/\s+/g, ' ').trim().slice(0, length)
}
const clean = cleanSourceText
export const validSymbolName = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 120

type WikiPage = { pageid?: number; title?: string; extract?: string; missing?: boolean; index?: number; thumbnail?: { source?: string }; redirects?: Array<{ title?: string }> }
type WikiResponse = { error?: unknown; query?: { redirects?: Array<{ from: string; to: string }>; pages?: WikiPage[] } }

// Share duplicate lookups across regions and pace upstream requests.
const wikiCache = new Map<string, { expires: number; result: ResearchResult }>()
const wikiPending = new Map<string, Promise<ResearchResult>>()
let wikiQueue: Promise<unknown> = Promise.resolve()
let wikiCooldownUntil = 0
function pacedWikiRequest<T>(request: () => Promise<T>): Promise<T> {
  const result = wikiQueue.then(request)
  wikiQueue = result.catch(() => undefined).then(() => new Promise(resolve => setTimeout(resolve, 150)))
  return result
}
export function wikipediaSearchTerm(name: string) {
  return name.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim() || name
}
export async function lookupWikipedia(symbolName: string, includeArticle = false): Promise<ResearchResult> {
  const key = normalizedName(symbolName) + (includeArticle ? ':article' : '')
  const cached = wikiCache.get(key)
  if (cached && cached.expires > Date.now()) return cached.result
  const pending = wikiPending.get(key)
  if (pending) return pending
  const request = retrieveWikipedia(symbolName, includeArticle).then(result => {
    if (wikiCache.size >= 200) wikiCache.delete(wikiCache.keys().next().value!)
    wikiCache.set(key, { result, expires: Date.now() + (result.status === 'unavailable' ? 15000 : 3600000) })
    return result
  }).finally(() => wikiPending.delete(key))
  wikiPending.set(key, request)
  return request
}
async function retrieveWikipedia(symbolName: string, includeArticle: boolean): Promise<ResearchResult> {
  try {
    const common = { action: 'query', format: 'json', formatversion: '2', prop: 'extracts|info|pageimages|redirects',
      explaintext: '1', inprop: 'url', piprop: 'thumbnail', pithumbsize: '384', redirects: '1', rdlimit: '30' }
    const query = async (extra: Record<string, string>): Promise<WikiResponse> => {
      const response = await pacedWikiRequest(async () => {
        if (Date.now() < wikiCooldownUntil) throw new Error('Wikipedia 429')
        const response = await fetch(`https://en.wikipedia.org/w/api.php?${new URLSearchParams({ ...common, ...extra })}`, {
        signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Semiote/0.1 (symbol reference lookup)' }, cache: 'no-store',
        })
        if (response.status === 429) {
          const retry = response.headers.get('retry-after')
          const delay = retry && /^\d+$/.test(retry) ? Number(retry) * 1000 : retry ? Date.parse(retry) - Date.now() : 15000
          wikiCooldownUntil = Date.now() + Math.min(300000, Math.max(15000, Number.isFinite(delay) ? delay : 15000))
        }
        return response
      })
      if (!response.ok) throw new Error(`Wikipedia ${response.status}`)
      const data = await response.json() as WikiResponse
      if (data.error) throw new Error('wikipedia_api_error')
      return data
    }
    const records = (data: WikiResponse, exact: boolean): ResearchSource[] => (data.query?.pages || [])
      .sort((a, b) => (a.index || 0) - (b.index || 0)).filter(page => !page.missing && page.pageid && page.title && !/\(disambiguation\)$/i.test(page.title) && clean(page.extract))
      .map(page => ({ page, aliases: [...(page.redirects || []).flatMap(redirect => redirect.title ? [redirect.title] : []),
        ...(data.query?.redirects || []).filter(redirect => normalizedName(redirect.to) === normalizedName(page.title!)).map(redirect => redirect.from)] }))
      .filter(({ page, aliases }) => exact || relevantTitle(symbolName, page.title!) || aliases.some(alias => normalizedName(alias) === normalizedName(symbolName)) || normalizedName(clean(page.extract)).includes(normalizedName(symbolName)))
      .map(({ page, aliases }) => ({ id: `wiki-${page.pageid}`, title: page.title!, kind: 'wikipedia' as const,
        url: `https://en.wikipedia.org/?curid=${page.pageid}`, excerpt: clean(page.extract, exact && includeArticle ? 60000 : 4000), candidateName: symbolName, candidateNames: [symbolName], aliases,
        imageUrl: page.thumbnail?.source?.startsWith('https://upload.wikimedia.org/') ? page.thumbnail.source : undefined }))
    // Resolve actual article titles/redirects first; use real search when absent.
    const exact = records(await query({ titles: symbolName, ...(includeArticle ? {} : { exchars: '4000' }) }), true)
    if (exact.length) return { sources: exact, status: 'available' }
    const sources = records(await query({ generator: 'search', exchars: '4000', gsrsearch: wikipediaSearchTerm(symbolName), gsrlimit: '3', gsrnamespace: '0' }), false)
    return { sources, status: sources.length ? 'available' : 'no_results' }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const failureCode = /^Wikipedia \d{3}$/.test(message) ? `http_${message.split(' ')[1]}` : message === 'wikipedia_api_error' ? 'api_error' : error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name) ? 'timeout' : 'network_error'
    return { sources: [], status: 'unavailable', failureCode }
  }
}

export async function lookupBooks(symbolName: string, contextText = ''): Promise<ResearchResult> {
  const key = process.env.GOOGLE_BOOKS_API_KEY
  if (!key) return { sources: [], status: 'unavailable' }
  try {
    const term = wikipediaSearchTerm(symbolName).replace(/"/g, '')
    const topicKey = normalizedName(term)
    if (!topicKey) return { sources: [], status: 'no_results' }
    const contextTerms = [...new Set(normalizedName(clean(contextText, 5000)).split(' ')
      .filter(word => word.length >= 4 && !new Set(['about', 'from', 'that', 'this', 'with', 'were', 'have', 'their', 'which', 'known', 'used', 'symbol', 'design', 'meaning', 'origin', 'period', 'appears', 'depicts', 'associated']).has(word)
        && !topicKey.split(' ').includes(word)))].slice(0, 8)
    const query = [`"${term}"`, ...contextTerms].join(' ')
    const params = new URLSearchParams({ q: query, key, maxResults: '20', printType: 'books' })
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`, { signal: AbortSignal.timeout(5000), next: { revalidate: 3600 } })
    if (!response.ok) throw new Error(`Books ${response.status}`)
    const data = await response.json() as { items?: Array<{ id?: string; volumeInfo?: { title?: string; description?: string; authors?: string[]; publishedDate?: string; categories?: string[] }; searchInfo?: { textSnippet?: string } }> }
    const sources = (data.items || []).filter(item => item.id && item.volumeInfo?.title && (item.searchInfo?.textSnippet || item.volumeInfo.description))
      .map(item => {
        const title = clean(item.volumeInfo!.title, 200)
        const description = clean(item.volumeInfo!.description || item.searchInfo?.textSnippet || '', 2000)
        const searchable = normalizedName(`${title} ${description} ${(item.volumeInfo!.categories || []).join(' ')}`)
        const identityMatch = relevantTitle(term, title) || searchable.includes(topicKey)
        const contextMatch = contextTerms.length > 0 && contextTerms.some(word => searchable.split(' ').includes(word))
        return { item, title, description, identityMatch, contextMatch }
      })
      .filter(result => result.identityMatch && result.contextMatch).slice(0, 3)
      .map(({ item, title, description }) => ({ id: `book-${item.id}`, title,
        url: `https://books.google.com/books?id=${encodeURIComponent(item.id!)}`, kind: 'book' as const, candidateName: symbolName,
        authors: item.volumeInfo!.authors?.map(author => clean(author, 120)).filter(Boolean).slice(0, 4),
        publishedYear: item.volumeInfo!.publishedDate?.match(/^\d{4}/)?.[0],
        excerpt: item.searchInfo?.textSnippet ? `Search snippet: ${clean(item.searchInfo.textSnippet, 600)}` : `Publisher description: ${clean(description, 600)}`,
      }))
    return { sources, status: sources.length ? 'available' : 'no_results' }
  } catch { return { sources: [], status: 'unavailable' } }
}
export function uniqueSources(sources: ResearchSource[]) {
  const records = new Map<string, ResearchSource>()
  for (const source of sources) {
    const previous = records.get(source.id)
    records.set(source.id, { ...source,
      candidateNames: [...new Set([...(previous?.candidateNames || (previous ? [previous.candidateName] : [])), ...(source.candidateNames || [source.candidateName])])],
      aliases: [...new Set([...(previous?.aliases || []), ...(source.aliases || [])])],
    })
  }
  return [...records.values()]
}

// Only thumbnails supplied by Wikipedia are downloaded, never model-provided URLs.
export async function referenceImage(source: ResearchSource): Promise<string | null> {
  if (!source.imageUrl?.startsWith('https://upload.wikimedia.org/')) return null
  try {
    const response = await fetch(source.imageUrl, { signal: AbortSignal.timeout(5000), redirect: 'error' })
    const type = response.headers.get('content-type')?.split(';')[0]
    if (!response.ok || !type || !['image/jpeg', 'image/png', 'image/webp'].includes(type)) return null
    if (Number(response.headers.get('content-length')) > 2_000_000) return null
    const reader = response.body?.getReader()
    if (!reader) return null
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > 2_000_000) { await reader.cancel(); return null }
      chunks.push(value)
    }
    return `data:${type};base64,${Buffer.concat(chunks).toString('base64')}`
  } catch { return null }
}

// Stable passage IDs let the model cite retrieved text without regenerating it.
export function sourcePassages(source: ResearchSource) {
  return (source.excerpt.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [source.excerpt])
    .map(text => text.trim()).filter(Boolean).map((text, index) => ({ id: `${source.id}:p${index + 1}`, text }))
}

export function citationPassages(sources: ResearchSource[]) {
  return sources.flatMap(source => sourcePassages(source).map(passage => ({ ...passage, sourceId: source.id })))
    .map((passage, index) => ({ ...passage, citationId: index + 1 }))
}
