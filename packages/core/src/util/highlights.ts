import { addDisposer } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { colord } from './colord.ts'
import { parseLocString } from './locString.ts'
import { getSession } from './mstUtils.ts'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { Theme } from '@mui/material'

// A translucent band drawn over a genomic region. Shared by the LGV and dotplot
// `view.highlight` arrays and the grid-bookmark overlays (which key/colorize
// bookmarks with the same helpers below).
export interface HighlightType {
  start: number
  end: number
  // optional because view.highlight is persisted via types.frozen and session
  // JSON authored by hand may legitimately omit the assemblyName
  assemblyName?: string
  refName: string
  // overrides the theme's highlight color; user-supplied color is used as-is so
  // explicit alpha is preserved
  color?: string
  // shown in the chip tooltip; otherwise a generic label is used
  label?: string
}

// Bands and bookmark overlays both render only while the session-wide
// `highlightsVisible` flag is on, so anything added while it is off draws
// nothing at all, which reads as "it didn't work". Watching the collection
// grow reveals for every path that adds to it rather than asking each call
// site to remember. `count` is seeded before the autorun so restoring a
// session that deliberately persisted bands-off doesn't flip it back on, and
// removals only lower the baseline — they never re-reveal, or the toggle could
// never be turned off.
export function revealHighlightsOnGrowth(
  node: IAnyStateTreeNode,
  count: () => number,
) {
  let prevCount = count()
  addDisposer(
    node,
    autorun(function highlightRevealAutorun() {
      const newCount = count()
      if (newCount > prevCount) {
        getSession(node).revealHighlights()
      }
      prevCount = newCount
    }),
  )
}

// Highlight regions have no id and can duplicate, so the trailing index only
// breaks ties between otherwise-identical regions. Wrapping the array index in
// this helper also keeps it out of the `no-array-index-key` lint's view.
// JSON-encoding the fields (rather than joining on a delimiter) avoids
// collisions when a refName contains the delimiter, e.g. `chr1_2`@3 vs
// `chr1`@`2_3`.
export function highlightKey(
  h: { assemblyName?: string; refName: string; start: number; end: number },
  i: number,
) {
  return JSON.stringify([h.assemblyName, h.refName, h.start, h.end, i])
}

// User-supplied color is used as-is so explicit alpha is preserved; otherwise
// fall back to the theme highlight color at the given alpha. Shared by the LGV
// and dotplot highlight bands (which differ only in their default alpha).
export function getHighlightColor(
  highlight: { color?: string },
  theme: Theme,
  alpha = 0.2,
) {
  return highlight.color
    ? colord(highlight.color)
    : colord(theme.palette.highlight.main).alpha(alpha)
}

function tryParseJson(s: string): Record<string, unknown> | undefined {
  try {
    const v: unknown = JSON.parse(s)
    return v && typeof v === 'object'
      ? (v as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

// a string is either a loc string ("chr1:100-200") or a JSON-encoded
// HighlightType (the URL wire-format, since URL params can't carry objects).
// note: the jbrowse-web &highlight= URL param is space-split, so the JSON-string
// form only survives when it contains no spaces; a label with a space is
// shattered by the split — pass a HighlightType object instead
function parseJsonHighlight(
  s: string,
  defaultAssembly: string,
): HighlightType | undefined {
  const json = s.trimStart().startsWith('{') ? tryParseJson(s) : undefined
  return json &&
    typeof json.refName === 'string' &&
    typeof json.start === 'number' &&
    typeof json.end === 'number'
    ? {
        refName: json.refName,
        start: json.start,
        end: json.end,
        assemblyName:
          typeof json.assemblyName === 'string'
            ? json.assemblyName
            : defaultAssembly,
        color: typeof json.color === 'string' ? json.color : undefined,
        label: typeof json.label === 'string' ? json.label : undefined,
      }
    : undefined
}

// The `{assembly}` prefix a locstring may carry is kept, not overwritten with
// the default: on a dotplot the two axes are two different assemblies, so
// `{mm10}chr1:1-100` stamped with the horizontal axis' assembly drew the band on
// the wrong axis (see DotplotView's axisHighlightRegion, which routes by exactly
// this field) with nothing said. Single-assembly views are unaffected — their
// only prefix is the default anyway.
function parseLocHighlight(
  s: string,
  defaultAssembly: string,
  isValidRefName: (refName: string, assemblyName?: string) => boolean,
): HighlightType | undefined {
  const { assemblyName, refName, start, end } = parseLocString(
    s,
    isValidRefName,
  )
  return start !== undefined && end !== undefined
    ? { refName, start, end, assemblyName: assemblyName ?? defaultAssembly }
    : undefined
}

// Normalize an `init.highlight` entry (HighlightType object, JSON string, or
// loc string) into a HighlightType, defaulting the assemblyName. Shared by
// LinearGenomeView and DotplotView, whose `init.highlight` accept the same
// three forms — the JSON shape-check in particular has to stay identical or a
// highlight that works in one view silently drops in the other.
export function coerceHighlight(
  h: string | HighlightType,
  defaultAssembly: string,
  // takes the assembly a `{...}` prefix named, so a caller with more than one
  // assembly in play validates the refName against the one the entry asked for
  isValidRefName: (refName: string, assemblyName?: string) => boolean,
): HighlightType | undefined {
  return typeof h === 'object'
    ? { ...h, assemblyName: h.assemblyName ?? defaultAssembly }
    : (parseJsonHighlight(h, defaultAssembly) ??
        parseLocHighlight(h, defaultAssembly, isValidRefName))
}
