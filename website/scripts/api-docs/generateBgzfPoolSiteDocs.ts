import { markdownTable, rewriteMarkerBlock } from './util.ts'

import type { SourceCorpus } from './util.ts'

// Render the list of adapters wired to the shared BGZF inflate pool into
// BGZF_WORKER_POOL.md, from the call sites.
//
// The sentence this replaces said the pool was "wired into `BamAdapter` and the
// nine `TabixIndexedFile` sites", and there are eight tabix sites — nine is the
// call-site total, BAM included. Which is the ordinary way a counted claim
// about source goes wrong: it was right when written, an adapter moved, and the
// number stayed. It also matters more than most, because this is the doc
// someone reads to answer "should my new adapter pass the pool too", and the
// answer is a list of the ones that already do.
//
// A call site rather than an import: `CramAdapter` imports the helper to talk
// about it in a comment (its own codec pool is a different pool, and the
// comment exists to say so) and does not pass one. Counting imports would file
// CRAM as wired and quietly overstate the coverage.
//
// The doc opts in with a marker pair, regenerated on `pnpm autogen`:
//
//   <!-- BGZF_POOL_SITES START -->
//   <!-- BGZF_POOL_SITES END -->

const CALL = /\bsharedBgzfWorkerPool\(\)/

// The plugin a call site belongs to. Everything that wires the pool is a reader
// in some plugin; `packages/core`'s own definition is the only other file that
// spells the name, and it is excluded by not matching.
const PLUGIN_PATH = /^plugins\/([^/]+)\//

interface Site {
  plugin: string
  reader: string
  file: string
}

export function collectBgzfPoolSites(corpus: SourceCorpus): Site[] {
  const out: Site[] = []
  for (const file of corpus.files) {
    if (file.includes('.test.') || !CALL.test(corpus.read(file))) {
      continue
    }
    const m = PLUGIN_PATH.exec(file)
    if (!m) {
      continue
    }
    // The BASENAME, not the containing directory. Most readers live in
    // `plugins/x/src/<Name>Adapter/<Name>Adapter.ts` where the two agree, and
    // `PifFile.ts` sits straight in `src/` — matching on the directory dropped
    // it silently, which is this generator's own failure mode arriving on its
    // first run: a coverage list that is quietly short reads exactly like a
    // coverage list that is complete.
    out.push({
      plugin: m[1]!,
      reader: file
        .split('/')
        .pop()!
        .replace(/\.tsx?$/, ''),
      file,
    })
  }
  return out.sort((a, b) => a.reader.localeCompare(b.reader))
}

function renderTable(sites: Site[]) {
  return markdownTable(
    ['Reader', 'Plugin'],
    sites.map(s => `| \`${s.reader}\` | \`${s.plugin}\` |`),
  )
}

export function writeBgzfPoolSiteDocs(
  corpus: SourceCorpus,
  { check = false } = {},
) {
  const sites = collectBgzfPoolSites(corpus)
  if (sites.length === 0) {
    throw new Error(
      'no sharedBgzfWorkerPool() call sites found — the helper was renamed, or the pool is wired nowhere',
    )
  }
  return rewriteMarkerBlock('BGZF_POOL_SITES', renderTable(sites), { check })
}
