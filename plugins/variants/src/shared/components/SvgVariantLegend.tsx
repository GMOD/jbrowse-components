import { SvgColorLegend } from '@jbrowse/core/ui'

import type { LegendSection } from '@jbrowse/plugin-linear-genome-view'

// The export counterpart of the on-screen `FloatingLegend`: without it an
// exported figure has colored genotype cells and nothing saying what the colors
// mean. `FloatingLegend`'s sections become one flat list, each preceded by a
// color-less heading row — the same flattening the alignments export uses, and
// with the same titles-only-when-multi-section rule the live legend applies, so
// a lone genotype key stays untitled. Empty sections drop out so a heading can't
// end up with nothing under it. No `onDismiss`: an exported legend can't be
// clicked (dismissed sections are already filtered out by `legendSections()`).
export default function SvgVariantLegend({
  sections,
  canvasWidth,
  maxHeight,
}: {
  sections: LegendSection[]
  canvasWidth: number
  maxHeight: number
}) {
  const nonEmpty = sections.filter(s => s.items.length > 0)
  const titled = nonEmpty.length > 1
  return (
    <SvgColorLegend
      canvasWidth={canvasWidth}
      maxHeight={maxHeight}
      testid="variant-color-legend"
      entries={nonEmpty.flatMap(section => [
        ...(titled && section.title
          ? [{ key: `${section.id}-title`, label: section.title }]
          : []),
        ...section.items.map((item, idx) => ({
          key: `${section.id}-${idx}`,
          label: item.label,
          color: item.color,
        })),
      ])}
    />
  )
}
