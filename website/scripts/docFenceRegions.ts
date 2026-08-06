// Slicing a `// #region name` out of a source file, for the doc fences
// `sync-doc-snippets` generates.
//
// Split out of that script so it can be tested: its failure mode is a doc that
// silently loses half a section. The script only ever compares what it produced
// against what the page already held, so a slice that stops early rewrites the
// page and then agrees with itself — both `--check` runs pass, and the only
// evidence is on the published page.

export const REGION_MARKER = /^\s*(\/\/|#)\s*#(end)?region\b/

const REGION_START = /^\s*(\/\/|#)\s*#region\b/
const REGION_END = /^\s*(\/\/|#)\s*#endregion\b/

/**
 * Drop every region marker line, for a whole-file include.
 */
export function stripRegionMarkers(source: string) {
  return source
    .replace(/\n+$/, '')
    .split('\n')
    .filter(l => !REGION_MARKER.test(l))
    .join('\n')
}

/**
 * The body of `#region <region>` in `source`, dedented, with any nested region
 * markers removed.
 *
 * Regions nest: a worked example is often one region so a guide can publish the
 * whole thing, while the sections leading up to it slice pieces of that same
 * code. Matching the first `#endregion` rather than the paired one truncated
 * the outer region at the first inner marker.
 */
export function extractRegion(source: string, file: string, region: string) {
  const lines = source.split('\n')
  const start = lines.findIndex(l =>
    new RegExp(`^\\s*(//|#)\\s*#region\\s+${region}\\b`).test(l),
  )
  if (start === -1) {
    throw new Error(`${file}: no "#region ${region}"`)
  }
  const rest = lines.slice(start + 1)
  let depth = 0
  const end = rest.findIndex(l => {
    if (REGION_START.test(l)) {
      depth++
    } else if (REGION_END.test(l)) {
      if (depth === 0) {
        return true
      }
      depth--
    }
    return false
  })
  if (end === -1) {
    throw new Error(`${file}: "#region ${region}" has no "#endregion"`)
  }
  const body = rest.slice(0, end).filter(l => !REGION_MARKER.test(l))
  const indent = Math.min(
    ...body.filter(l => l.trim()).map(l => l.length - l.trimStart().length),
  )
  return body.map(l => l.slice(indent)).join('\n')
}

// Fence languages that compile — the ones an `<!-- include: -->` could point at
// (a `json` config sample or a `bash` command has no source to point at, so it
// is not debt), and the ones check-doc-imports.ts scans for import statements.
export const CODE_FENCE_LANGS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'typescript',
  'javascript',
])

// Opening line of a fence, capturing its info string.
export const FENCE = /^\s*```(\S*)/

const INCLUDE_MARKER = /^<!--\s*include:\s*(\S+?)\s*-->$/
// The other generator families — COLOR_TABLE, JEXL_CATALOG, PALETTE_KEYS and
// friends — bracket their output with `<!-- NAME … START -->` / `END`.
const GENERATED_START = /^<!--\s*[A-Z_]+[^>]*\bSTART\b[^>]*-->$/
const GENERATED_END = /^<!--\s*[A-Z_]+[^>]*\bEND\b[^>]*-->$/

/**
 * Count the hand-written TS/JS fences in one page: the ratchet's unit of debt.
 *
 * Fences inside another generator's marker block do not count. `jexl.md` is why
 * — its function catalog is generated, emits ```js blocks, and carries no
 * `include:` marker because it is not that kind of generated. Counting those
 * would have booked eight generated fences as debt no one could ever pay down.
 */
export function countUnIncludedFences(text: string) {
  const lines = text.split('\n')
  let inFence = false
  let inGenerated = false
  let count = 0
  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (!inFence && GENERATED_START.test(trimmed)) {
      inGenerated = true
      return
    }
    if (!inFence && GENERATED_END.test(trimmed)) {
      inGenerated = false
      return
    }
    const fence = FENCE.exec(line)
    if (!fence) {
      return
    }
    if (inFence) {
      inFence = false
      return
    }
    inFence = true
    if (inGenerated) {
      return
    }
    // the marker sits one or two lines up (the formatter inserts a blank line)
    const marked = [1, 2].some(k =>
      INCLUDE_MARKER.test((lines[i - k] ?? '').trim()),
    )
    if (!marked && CODE_FENCE_LANGS.has(fence[1]!.toLowerCase())) {
      count++
    }
  })
  return count
}

// Whole generated trees and generated pages, docs-relative. Their fences come
// from a JSDoc tag at a definition site, so they are already tied to source and
// are not the ratchet's business.
const GENERATED_DIRS = ['config/', 'models/', 'api/']
const GENERATED_PAGES = new Set(['cli.md', 'jbrowse-img.md'])

/**
 * Is this docs-relative path generated?
 *
 * The trailing slashes are load-bearing. `config_guides/jexl.md` starts with
 * `config`, so a bare prefix test exempts six hand-written config guides and
 * two tutorials — the ratchet then reports a smaller number than the truth and
 * the pages it skipped are free to grow.
 */
export function isGeneratedDocPath(relativePath: string) {
  return (
    GENERATED_DIRS.some(d => relativePath.startsWith(d)) ||
    GENERATED_PAGES.has(relativePath)
  )
}
