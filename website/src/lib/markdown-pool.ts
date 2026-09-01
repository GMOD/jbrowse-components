import { availableParallelism } from 'node:os'
import { Worker } from 'node:worker_threads'

import { getCollection } from 'astro:content'

import { baseUrl } from './base-url.ts'
import { renderMarkdown } from './markdown.ts'

import type { AutogenDoc } from './autogen-links.ts'
import type { RenderedMarkdown } from './markdown-core.ts'

// Astro renders routes one at a time on one thread, and for this site that pass
// is almost entirely unified: rendering the docs corpus is most of it. The
// pipeline is a pure function of (corpus, baseUrl, body), so the whole corpus
// can be rendered up front across threads and each page then reads its own
// result — a 542-page route pass goes 32.5s to 14.2s, over byte-identical
// output.
//
// The corpus still comes from astro:content on this side and is cloned into the
// workers, so there is one reader of what the docs collection is. A worker that
// cannot start, or a doc that comes back an error, falls back to rendering in
// process: the pool is a speed-up over the single-threaded path, never the only
// way a page can render.
//
// Four, because eight measured no faster: each worker pays its own load of
// shiki and the pipeline plus a clone of the corpus, and the machine running a
// docs build is rarely idle.
const MAX_WORKERS = 4

// astro build runs from a bundle in a temp directory, so import.meta.url here
// does not lead back to the source tree. The integration in astro.config.mjs
// resolves the worker against the config file, which does — and sets it only on
// astro:build:start, so `astro dev` falls through to the single-page path and
// does not pay for the whole corpus to serve one request.
const workerPath = process.env.MARKDOWN_WORKER_PATH

interface Job {
  id: string
  body: string
}

function runPool(jobs: Job[], docs: AutogenDoc[], path: string) {
  return new Promise<Map<string, RenderedMarkdown>>((resolve, reject) => {
    const done = new Map<string, RenderedMarkdown>()
    const count = Math.min(MAX_WORKERS, availableParallelism(), jobs.length)
    let next = 0
    let live = count
    const workers = Array.from(
      { length: count },
      () => new Worker(path, { workerData: { baseUrl, docs } }),
    )
    const finish = (worker: Worker) => {
      void worker.terminate()
      live--
      if (live === 0) {
        resolve(done)
      }
    }
    const feed = (worker: Worker) => {
      if (next < jobs.length) {
        worker.postMessage(jobs[next++])
      } else {
        finish(worker)
      }
    }
    for (const worker of workers) {
      worker.on(
        'message',
        ({ id, rendered }: { id: string; rendered?: RenderedMarkdown }) => {
          if (rendered) {
            done.set(id, rendered)
          }
          feed(worker)
        },
      )
      worker.on('error', reject)
      feed(worker)
    }
  })
}

let batch: Promise<Map<string, RenderedMarkdown>> | undefined

async function renderCorpus() {
  const empty = new Map<string, RenderedMarkdown>()
  if (workerPath && availableParallelism() > 1) {
    const docs: AutogenDoc[] = (await getCollection('docs')).map(d => ({
      id: d.id,
      data: d.data,
      body: d.body,
    }))
    const jobs = docs.map(d => ({ id: d.id, body: d.body ?? '' }))
    return runPool(jobs, docs, workerPath).catch((error: unknown) => {
      console.warn(`[markdown-pool] rendering in process: ${String(error)}`)
      return empty
    })
  }
  return empty
}

// One doc's rendered markdown, off the batch the first caller starts.
export async function renderDoc(
  id: string,
  body: string,
): Promise<RenderedMarkdown> {
  batch ??= renderCorpus()
  return (await batch).get(id) ?? renderMarkdown(body, id)
}
