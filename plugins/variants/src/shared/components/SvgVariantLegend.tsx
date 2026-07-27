import { SvgColorLegend, legendEntries } from '@jbrowse/core/ui'

import type { LegendSection } from '@jbrowse/core/ui'

// The export counterpart of the on-screen `FloatingLegend`: without it an
// exported figure has colored genotype cells and nothing saying what the colors
// mean. Both take the same section list, and `legendEntries` applies the same
// titles-only-when-multi-section rule the live legend does, so a lone genotype
// key stays untitled. No `onDismiss`: an exported legend can't be clicked
// (dismissed sections are already filtered out by `legendSections()`).
export default function SvgVariantLegend({
  sections,
  canvasWidth,
  maxHeight,
}: {
  sections: LegendSection[]
  canvasWidth: number
  maxHeight: number
}) {
  return (
    <SvgColorLegend
      canvasWidth={canvasWidth}
      maxHeight={maxHeight}
      testid="variant-color-legend"
      entries={legendEntries({ sections })}
    />
  )
}
