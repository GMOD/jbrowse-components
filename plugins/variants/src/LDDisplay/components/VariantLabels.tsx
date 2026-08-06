import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { observer } from 'mobx-react'

import type { SharedLDModel } from '../shared.ts'

// Reads the same `connectorLineCoords` the lines do, so a label and its line
// always sit at one x. A SNP with no VCF ID (no `label`) is left unlabeled — its
// position on the axis already locates it, and there is no user-facing name.
const VariantLabels = observer(function VariantLabels({
  model,
}: {
  model: SharedLDModel
}) {
  // `usePalette`, not MUI's `useTheme`: this is display *content*, which an
  // embedding app supplies colors for through PaletteProvider without mounting
  // a ThemeProvider at all.
  const palette = usePalette()
  const { connectorLineCoords, showLabels } = model

  return showLabels ? (
    <>
      {connectorLineCoords.map(({ gx, label }, i) =>
        label ? (
          <text
            // eslint-disable-next-line @eslint-react/no-array-index-key -- labels may be duplicated (multi-allelic sites share an id); idx only breaks ties
            key={`${label}-${i}`}
            x={gx}
            y={0}
            transform={`rotate(-90, ${gx}, 0)`}
            fontSize={10}
            textAnchor="end"
            dominantBaseline="middle"
            fill={palette.text.primary}
            style={{ pointerEvents: 'none' }}
          >
            {label}
          </text>
        ) : null,
      )}
    </>
  ) : null
})

export default VariantLabels
