import fs from 'fs'
import path from 'path'

import { markdownTable, rewriteMarkerBlock } from './util.ts'

// Which shared `.slang` module in render-core each shader imports, rendered
// into SHADER_SHAPE_LIBRARY.md from the import lines themselves.
//
// That doc shipped with the table hand-written and a sentence under it telling
// the reader to re-derive it with a grep — which is the shape
// `agent-docs/CLAUDE.md` rules out by name: "if a sentence tells the reader to
// go look at a file, generate the table under it from that file". The consumer
// set is the fact most likely to move (a shape earns its place on having two
// real consumers, so a row appearing or vanishing is the ADR-040 bar being
// crossed in one direction or the other) and the least likely to be noticed
// moving.
//
// **The table is deliberately the whole set, not just the shapes.** Which
// modules count as shapes and which are atoms is a judgement the doc's prose
// makes; a scan cannot. Listing every module means a new one shows up here as
// an untagged row rather than being silently absent, the same way
// SHADER_LIFT_INVENTORY's Candidates table surfaces an undecided export.
//
// What the scan CANNOT see, and the prose therefore owns: which half of a
// module a consumer takes. `linkedReadLine` imports `capsule` for the frame and
// deliberately not the coverage, and an import line cannot say so.
const SHARED_SHADER_DIR = 'packages/render-core/src/shaders'
const SCAN_ROOTS = ['plugins', 'packages']

function slangFiles(dir: string, out: string[] = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'esm') {
        slangFiles(full, out)
      }
    } else if (entry.name.endsWith('.slang')) {
      out.push(full)
    }
  }
  return out
}

// `plugins/wiggle/src/shared/shaders/wiggleLine.slang` -> `wiggle/wiggleLine`,
// which is how the doc's prose names them: the plugin, then the shader. A
// render-core module importing another one says `render-core/` instead, so an
// internal edge (coverageBar -> coverageBand) is not mistaken for a consumer.
function label(file: string) {
  const parts = file.split(path.sep)
  const name = path.basename(file, '.slang')
  const owner = parts[0] === 'plugins' ? parts[1] : 'render-core'
  return `${owner}/${name}`
}

export function collectShapeConsumers() {
  const modules = fs
    .readdirSync(SHARED_SHADER_DIR)
    .filter(f => f.endsWith('.slang'))
    .map(f => path.basename(f, '.slang'))
    .sort()

  const files = SCAN_ROOTS.flatMap(root => slangFiles(root))
  const consumers = new Map<string, string[]>(modules.map(m => [m, []]))
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8')
    for (const m of modules) {
      // The import statement only — not a mention in a comment, which is how
      // `diagonalGrid.slang`'s own "Imported via `import diagonalGrid;`" header
      // would otherwise list the module as importing itself.
      if (new RegExp(`^import ${m};`, 'm').test(text)) {
        consumers.get(m)!.push(label(file))
      }
    }
  }
  return modules.map(name => ({
    name,
    importers: [...new Set(consumers.get(name)!)].sort(),
  }))
}

// Past a dozen importers a module is not a shape by any reading — it is an atom
// most of the tree calls — and the count is the whole fact the row carries. The
// names are what matter near ADR-040's two-consumer bar, where the question is
// which displays would break if the module moved; spelling out `hpmath`'s 41
// answers "all of them" in 700 characters.
const NAME_THEM_UP_TO = 12

export function writeShaderShapeDocs({ check = false } = {}) {
  const rows = collectShapeConsumers().map(({ name, importers }) => {
    const who = !importers.length
      ? '—'
      : importers.length > NAME_THEM_UP_TO
        ? '_most of the tree_'
        : importers.map(i => `\`${i}\``).join(', ')
    return `| \`${name}\` | ${importers.length} | ${who} |`
  })
  return rewriteMarkerBlock(
    'SHADER_SHAPE_CONSUMERS',
    markdownTable(['Module', 'Importers', 'Imported by'], rows),
    { check },
  )
}
