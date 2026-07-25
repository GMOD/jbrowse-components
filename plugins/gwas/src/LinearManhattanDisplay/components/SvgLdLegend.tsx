import { SvgColorLegend } from '@jbrowse/core/ui'

import { LD_LEGEND, LD_LEGEND_TITLE } from '../ldBins.ts'

// SVG-export counterpart of the on-screen (HTML/MUI) LdColorLegend: the r² key
// shown top-right when points are colored by LD to the index SNP. Bin data is
// shared with the live legend, box geometry with every other exported color
// key. The hand-rolled box this replaced sized itself to a hardcoded 88px and
// ignored the track height, so at the default 100px it was cut mid-swatch by
// SVGTracks' per-track clip; SvgColorLegend measures its own width and folds
// what doesn't fit into a "+N more" row.
//
// `indexSnpMissing` adds the note the on-screen LdIndexWarning shows: without
// it an export where nothing matched the index SNP is an all-grey plot under a
// full r² key that implies the colors mean something. Abbreviated to a row's
// worth of text, since the legend sizes itself to its longest label.
export default function SvgLdLegend({
  canvasWidth,
  maxHeight,
  indexSnpMissing,
  indexSnpOffscreen,
}: {
  canvasWidth: number
  // the track height below the legend's own offset, so the box can't be clipped
  maxHeight: number
  indexSnpMissing: boolean
  indexSnpOffscreen: boolean
}) {
  return (
    <SvgColorLegend
      canvasWidth={canvasWidth}
      maxHeight={maxHeight}
      testid="manhattan-ld-legend"
      entries={[
        { key: 'title', label: LD_LEGEND_TITLE },
        ...LD_LEGEND.map(({ label, color }) => ({ key: label, label, color })),
        ...(indexSnpMissing
          ? [
              {
                key: 'index-missing',
                label: indexSnpOffscreen
                  ? 'Index SNP off-screen: all grey'
                  : 'Index SNP not in LD data: all grey',
              },
            ]
          : []),
      ]}
    />
  )
}
