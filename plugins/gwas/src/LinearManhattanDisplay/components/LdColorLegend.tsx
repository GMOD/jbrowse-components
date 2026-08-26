import { FloatingLegend } from '@jbrowse/plugin-linear-genome-view'

import { LD_LEGEND, LD_LEGEND_TITLE } from '../ldBins.ts'

// LocusZoom-style r² key, shown when the display colors points by LD to the
// index SNP. Uses the shared FloatingLegend box (top-right overlay + close
// button); the bins come from ldBins so the SVG-export legend can't drift.
export default function LdColorLegend({
  onDismiss,
}: {
  onDismiss?: () => void
}) {
  return (
    <FloatingLegend
      title={LD_LEGEND_TITLE}
      items={LD_LEGEND}
      onDismiss={onDismiss}
    />
  )
}
