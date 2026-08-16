// The real config plus one Vite plugin that dumps the module graph. Used by
// `pnpm probe-eager-graph`; see scripts/eagerGraph.mjs for what the two halves
// of the dump are and why neither answers anything on its own.
//
// A separate config rather than a flag on the real one so a normal `pnpm build`
// — the one `measure-eager-bundle` and `smoke` read — carries no probe.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import base from './astro.config.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const outFile = path.join(here, 'node_modules/.cache/eager-graph.json')

// One build runs several rollup passes (server, then client), and the client
// pass is the one whose chunks the HTML names — but they share this object, and
// keying by module id means a later pass simply overwrites with the same facts.
const graph = { source: {}, chunks: {} }

function graphProbe() {
  return {
    name: 'jbrowse-eager-graph-probe',
    // Pre-treeshake: what the source says could be reached. Barrels are still
    // barrels here, which is exactly what the post-bundle graph loses.
    buildEnd() {
      for (const id of this.getModuleIds()) {
        const info = this.getModuleInfo(id)
        if (info) {
          graph.source[id] = {
            imports: info.importedIds,
            dynamic: info.dynamicallyImportedIds,
          }
        }
      }
    },
    // Post-treeshake: what survived, which chunk it landed in, and what it cost
    // there.
    generateBundle(_options, bundle) {
      for (const [file, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk') {
          graph.chunks[file] = {
            imports: chunk.imports,
            dynamicImports: chunk.dynamicImports,
            // the module the chunk exists for, when it is an entry — the root a
            // per-page walk of `graph.source` starts from. Without it the only
            // available roots are "every module in the entry chunk", which is
            // the co-location the walk is trying to get out from under.
            facadeModuleId: chunk.facadeModuleId,
            modules: Object.fromEntries(
              Object.entries(chunk.modules).map(([id, m]) => [
                id,
                m.renderedLength,
              ]),
            ),
          }
        }
      }
    },
    closeBundle() {
      mkdirSync(path.dirname(outFile), { recursive: true })
      writeFileSync(outFile, JSON.stringify(graph))
    },
  }
}

export default {
  ...base,
  vite: {
    ...base.vite,
    plugins: [...(base.vite?.plugins ?? []), graphProbe()],
  },
}
