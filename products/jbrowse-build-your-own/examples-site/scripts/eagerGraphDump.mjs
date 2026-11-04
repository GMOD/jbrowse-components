// A Vite plugin that dumps the module graph of every build, so the eager-bundle
// check can say which directories a number moved in, and `pnpm
// probe-eager-graph` can say why. See scripts/eagerGraph.mjs for what the two
// halves of the dump are and why neither answers anything on its own.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const site = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

export const eagerGraphFile = path.join(
  site,
  'node_modules/.cache/eager-graph.json',
)

export function eagerGraphDump() {
  // One build runs several rollup passes (server, then client), and the client
  // pass is the one whose chunks the HTML names — but they share this object,
  // and keying by module id means a later pass overwrites with the same facts.
  const graph = { source: {}, chunks: {} }
  return {
    name: 'jbrowse-eager-graph-dump',
    // vite's dev server also calls buildEnd/closeBundle on close, which would
    // overwrite the dump with an empty graph
    apply: 'build',
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
    // Post-treeshake: what survived, which chunk it landed in, and what it
    // cost there.
    generateBundle(_options, bundle) {
      for (const [file, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk') {
          graph.chunks[file] = {
            imports: chunk.imports,
            dynamicImports: chunk.dynamicImports,
            // the module the chunk exists for, when it is an entry — the root
            // a per-page walk of `graph.source` starts from
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
      mkdirSync(path.dirname(eagerGraphFile), { recursive: true })
      writeFileSync(eagerGraphFile, JSON.stringify(graph))
    },
  }
}
