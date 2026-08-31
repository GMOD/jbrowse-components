// One (row, name, color) combination a worker found while packing its features,
// and the whole of what a DERIVED color key is built from — the key a display
// reads off its data, as opposed to one an admin declared in a config slot.
//
// `rowIndex` indexes the packer's own row list, because the main thread is the
// side that knows whether that row paints the packed color at all: it may be
// filtered off screen, or painting a per-row color override.
export interface LegendCandidate {
  rowIndex: number
  label: string
  // ABGR-packed, as the worker baked it into the painting
  color: number
}

// One row of a derived key: a color, named by the first label seen in it.
export interface LegendEntry {
  label: string
  color: number
}

// How many distinct colors a derived key may name and still BE a key. Past this
// the data is not a categorical vocabulary (a track keyed by unique per-feature
// names), and a list of every feature is the thing a key exists instead of.
//
// A different question from `legendIsReadable`'s lower bar, which asks whether a
// key a display already has is worth the rows it costs.
export const MAX_LEGEND_ENTRIES = 30

// Bound on the candidate list one region ships. Far above MAX_LEGEND_ENTRIES, so
// a vocabulary that is categorical at all crosses whole, and a track with a name
// per feature ships a prefix that reads the same way it would have.
export const MAX_LEGEND_CANDIDATES = 1024

/**
 * Accumulator for the distinct (row, name, color) combinations a packer walks
 * past, in first-seen order and bounded — the small list `unionLegendCandidates`
 * derives a key from, so the main thread never re-walks the features. Fed scalar
 * by scalar, from the loop that already holds the three values.
 *
 * Deduped on the whole triple rather than on (row, color): the union takes the
 * first NAME it sees for a color, so where that name is already spoken for, the
 * second name on that color has to still be in the list to carry it.
 *
 * A nameless feature contributes nothing, which is the union's rule too — so a
 * track whose features have no names ships an empty list rather than one entry
 * per feature.
 */
export function createLegendCandidateCollector(
  maxCandidates = MAX_LEGEND_CANDIDATES,
) {
  const candidates: LegendCandidate[] = []
  const colorsSeen = new Map<number, Map<string, Set<number>>>()
  return {
    candidates,
    add(rowIndex: number, label: string, color: number) {
      if (label !== '' && candidates.length < maxCandidates) {
        let byLabel = colorsSeen.get(rowIndex)
        if (byLabel === undefined) {
          byLabel = new Map()
          colorsSeen.set(rowIndex, byLabel)
        }
        let colors = byLabel.get(label)
        if (colors === undefined) {
          colors = new Set()
          byLabel.set(label, colors)
        }
        if (!colors.has(color)) {
          colors.add(color)
          candidates.push({ rowIndex, label, color })
        }
      }
    },
  }
}

// One region's candidates, plus which of its rows actually paint them: a row
// filtered off screen, or painting a per-row color override, contributes no key
// entry, and only the main thread knows which those are.
export interface LegendCandidateSource {
  candidates: readonly LegendCandidate[]
  rowPaintsCandidateColor: (rowIndex: number) => boolean
}

/**
 * The categorical color key over any number of packed regions: one entry per
 * distinct color, labeled by the first name seen in that color, in first-seen
 * order.
 *
 * Keyed by color rather than by name, so each key row is 1:1 with a color — a
 * row is normally a toggle and hiding a category hides features BY color, so two
 * names sharing one color must collapse to a single row. A name reused across
 * two colors keeps its first-seen color.
 *
 * `[]` when the data carries no categorical signal: nothing named, or more than
 * `maxEntries` distinct colors.
 *
 * `regions` is consumed lazily, so a caller able to answer without reading any
 * of them can pass a generator and have none of them touched.
 */
export function unionLegendCandidates<T>(
  regions: Iterable<T>,
  resolve: (region: T) => LegendCandidateSource,
  maxEntries = MAX_LEGEND_ENTRIES,
) {
  const entries: LegendEntry[] = []
  const seenColors = new Set<number>()
  const seenLabels = new Set<string>()
  for (const region of regions) {
    const { candidates, rowPaintsCandidateColor } = resolve(region)
    for (const { rowIndex, label, color } of candidates) {
      if (
        rowPaintsCandidateColor(rowIndex) &&
        !seenLabels.has(label) &&
        !seenColors.has(color)
      ) {
        seenLabels.add(label)
        seenColors.add(color)
        entries.push({ label, color })
        if (entries.length > maxEntries) {
          return []
        }
      }
    }
  }
  return entries
}
