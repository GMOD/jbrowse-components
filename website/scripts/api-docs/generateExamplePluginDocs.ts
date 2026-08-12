import fs from 'fs'
import path from 'path'

import { rewriteMarkerBlock } from './util.ts'

// The score-example plugin's file tree, rendered into both walkthroughs from the
// directory itself.
//
// Each page used to draw its own tree by hand for the same plugin, and between
// them they had four errors: neither listed `src/index.ts` or the feature panel,
// the GPU page omitted `buildScoreResult.ts`, and the Canvas2D page described a
// factory living inside the renderer file when the example has a separate one.
// Nothing could catch that, because a hand-drawn tree of a real directory is
// checked by nobody.
//
// So the rows come from the directory (a file cannot be omitted) and the prose
// from a tag at the top of each file:
//
//   // #exampleFile shared | MST model: rpcDataMap, renderState, fetchNeeded
//   // #exampleFile gpu | vertex + fragment for one pass
//
// `gpu` marks a file only the GPU path needs, which is what lets one block serve
// both guides — same reasoning as CROSS_CUTTING_MIXINS rendering into the guide
// and the architecture spec. An untagged file is fatal.

const ROOT = 'example-plugins/score-example/src'

// Tests and generated modules are not files a reader creates: a test is not part
// of the walkthrough, and `*.generated.ts` is emitted by `gen:shaders` and must
// never be hand-edited.
function isWalkthroughFile(name: string) {
  return (
    /\.(tsx?|slang)$/.test(name) &&
    !/\.test\.tsx?$/.test(name) &&
    !/\.generated\.ts$/.test(name)
  )
}

interface Entry {
  /** path relative to ROOT, e.g. `LinearScoreDisplay/model.ts` */
  rel: string
  scope: string
  description: string
}

// Files before subdirectories at each level, each alphabetically — so a
// directory's own entry point reads above the tree of what it pulls in, and
// `src/index.ts` heads the whole listing rather than sorting under `L`.
function walk(dir: string, out: string[]) {
  const names = fs.readdirSync(dir).sort()
  const dirs: string[] = []
  for (const name of names) {
    const full = path.join(dir, name)
    if (fs.statSync(full).isDirectory()) {
      dirs.push(full)
    } else if (isWalkthroughFile(name)) {
      out.push(full)
    }
  }
  for (const d of dirs) {
    walk(d, out)
  }
}

function collect(): Entry[] {
  const files: string[] = []
  walk(ROOT, files)
  const entries: Entry[] = []
  const untagged: string[] = []
  for (const file of files) {
    const m =
      /#exampleFile\s+(shared|gpu)\s*\|\s*([^\n*]+?)\s*(?:\*\/|\n)/.exec(
        fs.readFileSync(file, 'utf8'),
      )
    if (m) {
      entries.push({
        rel: path.relative(ROOT, file),
        scope: m[1]!,
        description: m[2]!.trim(),
      })
    } else {
      untagged.push(path.relative(ROOT, file))
    }
  }
  if (untagged.length > 0) {
    throw new Error(
      `these ${ROOT} files carry no \`// #exampleFile <shared|gpu> | <description>\` tag, so they would be missing from the walkthrough file trees: ${untagged.sort().join(', ')}`,
    )
  }
  return entries
}

/**
 * An indented listing rather than box-drawing characters: the rows carry a
 * description column, and `├──` prefixes push every description right by the
 * depth of its directory, so the column stops lining up exactly where the tree
 * gets deep enough to need it.
 */
function renderTree(entries: Entry[]) {
  const rows: { label: string; description: string }[] = [
    { label: 'src/', description: '' },
  ]
  const opened = new Set<string>()
  for (const e of entries) {
    const parent = path.dirname(e.rel)
    if (parent !== '.') {
      const parts = parent.split('/')
      for (let i = 0; i < parts.length; i++) {
        const sub = parts.slice(0, i + 1).join('/')
        if (!opened.has(sub)) {
          opened.add(sub)
          rows.push({
            label: `${'  '.repeat(i + 1)}${parts[i]}/`,
            description: '',
          })
        }
      }
    }
    const depth = parent === '.' ? 0 : parent.split('/').length
    rows.push({
      label: `${'  '.repeat(depth + 1)}${path.basename(e.rel)}`,
      description:
        e.scope === 'gpu' ? `[GPU only] ${e.description}` : e.description,
    })
  }
  const width = Math.max(...rows.map(r => r.label.length)) + 2
  return [
    '```',
    ...rows.map(r =>
      r.description ? `${r.label.padEnd(width)}${r.description}` : r.label,
    ),
    '```',
  ].join('\n')
}

export function writeExamplePluginDocs({ check = false } = {}) {
  return rewriteMarkerBlock('EXAMPLE_PLUGIN_TREE', renderTree(collect()), {
    check,
  })
}
