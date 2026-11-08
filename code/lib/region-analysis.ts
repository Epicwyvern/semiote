export type RegionAnalysisState = { status: 'queued' | 'analyzing' | 'complete' | 'error'; error?: string }

// A bounded queue per image session. Reset settles queued promises and aborts
// active requests; stale completions cannot mutate a replacement image.
export function createRegionAnalysisManager<T>(callbacks: {
  onState: (id: string, state: RegionAnalysisState) => void
  onResult: (id: string, result: T) => void
}, concurrency = 2) {
  let session = 0
  let active = 0
  type Job = { id: string; session: number; task: (signal: AbortSignal) => Promise<T>; controller: AbortController; promise: Promise<boolean>; resolve: (value: boolean) => void }
  const requests = new Map<string, Job>()
  const queue: Job[] = []
  const pump = () => {
    while (active < Math.max(1, concurrency) && queue.length) {
      const job = queue.shift()!
      active++
      callbacks.onState(job.id, { status: 'analyzing' })
      Promise.resolve().then(() => {
        if (job.session !== session) return undefined
        return job.task(job.controller.signal)
      }).then(result => {
        if (job.session !== session) return
        callbacks.onResult(job.id, result as T)
        callbacks.onState(job.id, { status: 'complete' })
        job.resolve(true)
      }).catch(error => {
        if (job.session === session) callbacks.onState(job.id, { status: 'error', error: error instanceof Error ? error.message : 'Symbol analysis failed' })
        job.resolve(false)
      }).finally(() => {
        if (job.session !== session) return
        requests.delete(job.id)
        active--
        pump()
      })
    }
  }
  return {
    reset() {
      session++
      for (const job of requests.values()) { job.controller.abort(); job.resolve(false) }
      requests.clear()
      queue.length = 0
      active = 0
    },
    run(id: string, task: (signal: AbortSignal) => Promise<T>, priority = false): Promise<boolean> {
      const existing = requests.get(id)
      if (existing) {
        const index = queue.indexOf(existing)
        if (priority && index > 0) { queue.splice(index, 1); queue.unshift(existing) }
        return existing.promise
      }
      let resolve!: (value: boolean) => void
      const promise = new Promise<boolean>(done => { resolve = done })
      const job: Job = { id, session, task, controller: new AbortController(), promise, resolve }
      requests.set(id, job)
      callbacks.onState(id, { status: 'queued' })
      if (priority) queue.unshift(job)
      else queue.push(job)
      pump()
      return promise
    },
  }
}

export function regionLabel(analysis?: { name: string; visualIdentification?: { status: string }; identification?: { status: string } }): string {
  if (!analysis || (analysis.visualIdentification?.status || analysis.identification?.status) === 'unidentified') return 'Unidentified symbol'
  return analysis.name.trim() || 'Unidentified symbol'
}
