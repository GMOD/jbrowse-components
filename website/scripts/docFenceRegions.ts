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

/** Drop every region marker line, for a whole-file include. */
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
