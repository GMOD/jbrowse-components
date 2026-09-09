import { SvgColorLegend, legendEntries } from '@jbrowse/core/ui'

import type { LegendSpec } from '@jbrowse/core/ui/legendSpec'

// SVG-export counterpart of the on-screen ManhattanLegend: the same `legend`
// value flattened into SvgColorLegend rows, with box geometry shared with every
// other exported color key. SvgColorLegend measures its own width and folds
// what does not fit into a "+N more" row, so a default-height track is not cut
// mid-swatch by SVGTracks' per-track clip.
//
// `indexSnpMissing` adds the note the on-screen LdIndexWarning shows: without
// it an export where nothing matched the index SNP is an all-grey plot under a
// full r² key that implies the colors mean something. Abbreviated to a row's
// worth of text, since the legend sizes itself to its longest label.
export default function SvgManhattanLegend({
  legend,
  canvasWidth,
  maxHeight,
  indexSnpMissing,
}: {
  legend: LegendSpec
  canvasWidth: number
  // the track height below the legend's own offset, so the box can't be clipped
  maxHeight: number
  indexSnpMissing: boolean
}) {
  return (
    <SvgColorLegend
      canvasWidth={canvasWidth}
      maxHeight={maxHeight}
      testid="manhattan-legend"
      entries={legendEntries({
        ...legend,
        items: [
          ...(legend.items ?? []),
          ...(indexSnpMissing
            ? [{ label: 'Index SNP not in LD data: all grey' }]
            : []),
        ],
      })}
    />
  )
}
