import { ExternalLink } from 'lucide-react'
import type { ResearchSource, ResearchResult } from '@/lib/symbol-research'

export type ResearchStatus = {
  wikipedia: Array<{ candidate: string; status: ResearchResult['status'] }>
  books: { status: ResearchResult['status'] }
}

type Props = {
  sources: ResearchSource[]
  furtherReading: ResearchSource[]
  comparedIds: string[]
  historicalIds: string[]
  status?: ResearchStatus
}

function SourceCard({ source, usage }: { source: ResearchSource; usage: string }) {
  // Links come from the lookup services, not free-form model output.
  let url: string | undefined
  try {
    const parsed = new URL(source.url)
    if (parsed.protocol === 'https:' && ['en.wikipedia.org', 'books.google.com'].includes(parsed.hostname)) url = parsed.href
  } catch { /* A source without a valid link can still show its recorded text. */ }
  return (
    <li className="min-w-0 border-t border-[#3A3A3A]/15 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 break-words font-bold text-[#816719] underline decoration-[#816719]/40 underline-offset-4 hover:decoration-[#816719]">
          {source.title}<ExternalLink size={15} className="shrink-0" /><span className="sr-only"> (opens in a new tab)</span>
        </a> : <p className="py-2 font-bold">{source.title}</p>}
        <span className="border border-[#3A3A3A]/15 bg-[#F7ECC8]/50 px-2 py-1 text-xs text-[#3A3A3A]">{usage}</span>
      </div>
      {source.candidateName && <p className="text-sm text-[#595959]">Retrieved for: {source.candidateName}</p>}
      {source.excerpt && <details className="mt-2">
        <summary className="cursor-pointer py-2 text-sm text-[#595959]">{source.kind === 'book' ? 'View search snippet or publisher description' : 'View article excerpt'}</summary>
        <p className="mt-1 whitespace-pre-line break-words text-base leading-relaxed text-[#3A3A3A]">{source.excerpt}</p>
      </details>}
    </li>
  )
}

export function DiscernSources({ sources, furtherReading, comparedIds, historicalIds, status }: Props) {
  const wikipedia = [...new Map(sources.filter(source => source.kind === 'wikipedia').map(source => [source.id, source])).values()]
  const books = [...new Map([...sources, ...furtherReading].filter(source => source.kind === 'book').map(source => [source.id, source])).values()]
  const unavailable = status?.wikipedia.filter(result => result.status === 'unavailable').length || 0
  return (
    <section aria-label="Sources" className="border border-[#3A3A3A]/20 bg-[#FDFBF6] p-5 sm:p-6 2xl:col-span-2">
      <h3 className="font-garamond text-2xl font-bold">Sources</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#595959]">References retrieved for this analysis. A retrieved result is not proof of a symbol's identity; the labels show how each reference was used.</p>
      <div className="mt-5">
        <h4 className="mb-2 font-bold">Wikipedia <span className="ml-1 font-normal text-[#595959]">({wikipedia.length})</span></h4>
        {wikipedia.length ? <ul>
          {wikipedia.map(source => <SourceCard key={source.id} source={source} usage={historicalIds.includes(source.id) ? 'Cited for historical context' : comparedIds.includes(source.id) ? 'Cited in candidate comparison' : 'Retrieved · not cited'} />)}
        </ul> : <p className="py-3 text-sm text-[#595959]">{unavailable ? 'Wikipedia could not be reached for the requested references.' : status ? 'No matching Wikipedia references were found.' : 'No Wikipedia references were saved for this analysis.'}</p>}
        {wikipedia.length > 0 && unavailable > 0 && <p className="text-sm text-[#595959]">Some additional Wikipedia lookups were unavailable.</p>}
      </div>
      <div className="mt-6">
        <h4 className="mb-2 font-bold">Books &amp; further reading <span className="ml-1 font-normal text-[#595959]">({books.length})</span></h4>
        <p className="mb-2 text-sm text-[#595959]">Google Books search results are suggestions for further reading. They were not used to establish the visual identification.</p>
        {books.length ? <ul>{books.map(source => <SourceCard key={source.id} source={source} usage="Supplementary reading" />)}</ul>
          : <p className="py-3 text-sm text-[#595959]">{status?.books.status === 'unavailable' ? 'Book lookup was unavailable or is not configured.' : status ? 'No book results were returned for this analysis.' : 'No book results were saved for this analysis.'}</p>}
      </div>
    </section>
  )
}
