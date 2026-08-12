import { markdownTable, rewriteMarkerBlock } from './util.ts'

import type { SourceCorpus } from './util.ts'

// Render a completeness index of every extension point into the hand-written
// extension_points guide, sourced from the actual registration/fire sites so the
// listing can never silently omit a point (the guide's per-point prose stays
// hand-written; only the index table is generated). Same docs-from-source idea
// as `#color`/`#config`/`#api`: each point is tagged once, at the canonical site
// where it is fired (or registered, for dynamically-fired points), with a JSDoc
//
//   /** #extensionPoint Core-extendSession | sync | Extend the session model */
//
// i.e. `#extensionPoint <id> | <sync|async> | <description>`. The guide opts the
// table in by dropping a marker pair, regenerated on `pnpm autogen`:
//
//   <!-- EXTENSION_POINTS_INDEX START -->
//   <!-- EXTENSION_POINTS_INDEX END -->
//
// Editing between the markers is pointless — it is overwritten on regen.

interface ExtensionPoint {
  id: string
  kind: string
  description: string
  shape?: string
}

// `#extensionPoint <id> | <sync|async> | <description>` occurrences in one file.
function collectFromFile(text: string, points: ExtensionPoint[]) {
  const re =
    /#extensionPoint\s+([\w-]+)\s*\|\s*(sync|async)\s*\|\s*([^\n*]+?)\s*(?:\*\/|\n)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    points.push({ id: m[1], kind: m[2], description: m[3].trim() })
  }
}

// Keys declared in an `ExtensionPointRegistry` augmentation. The registry is the
// closest thing to a manifest of extension points, so it is what makes "the
// listing can never silently omit a point" enforceable rather than aspirational
// — a typed point with no `#extensionPoint` tag is an error below. (A point that
// is neither typed nor tagged still slips through; typing it is the fix, and is
// wanted anyway.)
function collectRegistryKeys(text: string, keys: Map<string, string>) {
  const blocks = /interface ExtensionPointRegistry\s*\{/g
  let m: RegExpExecArray | null
  while ((m = blocks.exec(text)) !== null) {
    // walk to the matching close brace so nested props don't end the block early
    let depth = 1
    let i = m.index + m[0].length
    const start = i
    while (i < text.length && depth > 0) {
      if (text[i] === '{') {
        depth++
      } else if (text[i] === '}') {
        depth--
      }
      i++
    }
    const block = text.slice(start, i)
    // the entry's own `args:` line, which is what says whether callbacks
    // accumulate into a list or hand one value along
    for (const k of block.matchAll(/^\s*'([\w-]+)':\s*\{([\s\S]*?)^\s*\}/gm)) {
      keys.set(k[1]!, /^\s*args:\s*(.+)$/m.exec(k[2]!)?.[1]?.trim() ?? '')
    }
  }
}

/**
 * What a second plugin registering on the same point does to the first, and so
 * which registration method the point takes. An array-valued `args` means every
 * callback appends and they all survive (`contributeToExtensionPoint`); `args:
 * undefined` means there is no value to overwrite at all, only side effects that
 * all run (`observeExtensionPoint`); anything else is a single value threaded
 * along, so each callback overwrites what the one before it returned
 * (`addToExtensionPoint`). This is the distinction that the point *names* don't
 * carry (`DotplotView-OverlaySVGComponent` accumulates,
 * `DotplotView-OverlayHTMLComponent` does not).
 *
 * `notify` is its own row rather than folded into `single` because the two are
 * opposites where it matters: on a `single` point only the last plugin to
 * register is visible, and on a `notify` point every plugin's callback runs.
 */
function shapeOf(args: string) {
  if (args === '') {
    return ''
  }
  if (args.endsWith('[]')) {
    return 'list'
  }
  return args === 'undefined' ? 'notify' : 'single'
}

function collectExtensionPoints(corpus: SourceCorpus): ExtensionPoint[] {
  const points: ExtensionPoint[] = []
  const registryKeys = new Map<string, string>()
  for (const file of corpus.files) {
    const text = corpus.read(file)
    collectFromFile(text, points)
    collectRegistryKeys(text, registryKeys)
  }
  const tagged = new Set(points.map(p => p.id))
  const untagged = [...registryKeys.keys()].filter(k => !tagged.has(k)).sort()
  if (untagged.length > 0) {
    throw new Error(
      `these extension points are in ExtensionPointRegistry but carry no \`#extensionPoint <id> | <sync|async> | <description>\` JSDoc tag, so they are missing from the docs index: ${untagged.join(', ')}`,
    )
  }
  // a tag duplicated across sites would otherwise double a row; keep the first
  const byId = new Map<string, ExtensionPoint>()
  for (const p of points) {
    const existing = byId.get(p.id)
    if (existing) {
      if (existing.kind !== p.kind || existing.description !== p.description) {
        throw new Error(
          `#extensionPoint ${p.id} is tagged inconsistently in more than one place`,
        )
      }
    } else {
      byId.set(p.id, p)
    }
  }
  return [...byId.values()]
    .map(p => ({ ...p, shape: shapeOf(registryKeys.get(p.id) ?? '') }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

function renderTable(points: ExtensionPoint[]) {
  return markdownTable(
    ['Extension point', 'Type', 'Shape', 'Description'],
    points.map(
      p => `| \`${p.id}\` | ${p.kind} | ${p.shape} | ${p.description} |`,
    ),
  )
}

// In `check` mode, report which docs have a stale index instead of rewriting —
// used by CI to fail when an extension point was added but the docs were not
// regenerated.
export function writeExtensionPointDocs(
  corpus: SourceCorpus,
  { check = false } = {},
) {
  return rewriteMarkerBlock(
    'EXTENSION_POINTS_INDEX',
    renderTable(collectExtensionPoints(corpus)),
    { check },
  )
}
