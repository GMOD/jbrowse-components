import type {
  DisplayEntry,
  RetiredDisplayType,
} from '@jbrowse/core/pluggableElementTypes'

// Runs on a config entry and on an old session's display instance alike, so
// it rewrites what the entry carries. The v4 colour, thickness and label were
// callbacks into the arc plugin's own jexl functions, which went with it
// (ADR-163), so they are dropped rather than carried.
function toLink(entry: DisplayEntry, mark: Record<string, unknown>) {
  const { renderer: _renderer, color: _color, ...rest } = entry
  return { ...rest, marks: [{ mark: 'link', ...mark }] }
}

// v4.3.0's two arc displays, which v4 share links and configs still name. A
// BED of start-end pairs drew one arc per record; a BEDPE, STAR-Fusion or SV
// VCF drew one per pair of ends, which is the `mate` step's job now.
export const retiredTypes: RetiredDisplayType[] = [
  {
    type: 'LinearArcDisplay',
    migrate: entry => toLink(entry, {}),
  },
  {
    type: 'LinearPairedArcDisplay',
    migrate: entry =>
      toLink(entry, {
        transform: [{ type: 'mate' }],
        encoding: { x2: { chrom: 'mate.refName', pos: 'mate.start' } },
      }),
  },
]
