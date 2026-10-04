import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { observer } from 'mobx-react'

import type { ConnectorCoord } from '../../shared/ConnectorLines.tsx'
import type { LDDisplayModel } from '../model.ts'

/**
 * Each SNP's id, rotated up from the top of its connector, so a label and its
 * line always sit at one x. A SNP with no VCF ID (no `label`) is left
 * unlabeled: its position on the axis already locates it. Plain, so the SVG
 * export draws it from coords it read once.
 */
export function ConnectorLabels({ coords }: { coords: ConnectorCoord[] }) {
  const palette = usePalette()
  return coords.map(({ gx, label }, i) =>
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
  )
}

const VariantLabels = observer(function VariantLabels({
  model,
}: {
  model: LDDisplayModel
}) {
  return model.showLabels ? (
    <ConnectorLabels coords={model.connectorLineCoords} />
  ) : null
})

export default VariantLabels
