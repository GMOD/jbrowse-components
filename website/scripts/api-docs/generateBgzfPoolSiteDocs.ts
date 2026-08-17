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

// The workspace a call site belongs to. Every reader that wires the pool today
// is a plugin, but the row is derived rather than assumed — see the throw below.
// `getAllFiles` already limits the corpus to these three trees, so what this has
// to place is the workspace NAME, and what the throw catches is a shape it
// cannot: a source file sitting directly in one of them rather than in a
// package under it.
const WORKSPACE_PATH = /^(?:plugins|products|packages)\/([^/]+)\//

// `packages/core` DEFINES the helper rather than wiring it, so it is not a site.
const DEFINITION = 'packages/core/src/util/bgzfWorkerPool.ts'

interface Site {
  plugin: string
  reader: string
  file: string
}

export function collectBgzfPoolSites(corpus: SourceCorpus): Site[] {
  const out: Site[] = []
  for (const file of corpus.files) {
    if (
      file.includes('.test.') ||
      file.endsWith(DEFINITION) ||
      !CALL.test(corpus.read(file))
    ) {
      continue
    }
    const m = WORKSPACE_PATH.exec(file)
    if (!m) {
      // Never `continue`. A call site this pattern cannot place is a row
      // missing from a list whose whole job is to be complete, and a coverage
      // list that is quietly short reads exactly like a complete one — which is
      // this generator's own history twice over. Keying off the containing
      // directory dropped `PifFile.ts` on the first run because it sits straight
      // in `src/`; keying the workspace off `plugins/` alone dropped a call site
      // added anywhere else, silently, while the table reported "up to date".
      throw new Error(
        `sharedBgzfWorkerPool() called from ${file}, which is outside plugins/, products/ and packages/ — widen WORKSPACE_PATH rather than letting the row vanish`,
      )
    }
    // The BASENAME, not the containing directory. Most readers live in
    // `plugins/x/src/<Name>Adapter/<Name>Adapter.ts` where the two agree, and
    // `PifFile.ts` sits straight in `src/`.
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
