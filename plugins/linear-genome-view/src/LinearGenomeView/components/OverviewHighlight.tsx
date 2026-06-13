import { notEmpty } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import OverviewHighlightBand from './OverviewHighlightBand.tsx'
import { getHighlightColor } from './util.ts'

import type { LinearGenomeViewModel } from '../model.ts'

type LGV = LinearGenomeViewModel

const OverviewHighlight = observer(function OverviewHighlight({
  model,
}: {
  model: LGV
}) {
  const theme = useTheme()
  const themed = colord(theme.palette.highlight.main)

  return model.highlight
    .map(highlight => {
      const coords = model.getOverviewHighlightCoords(highlight)
      return coords ? { coords, highlight } : undefined
    })
    .filter(notEmpty)
    .map(({ coords, highlight }) => {
      const bandColor = getHighlightColor(highlight, theme)
      return (
        <OverviewHighlightBand
          // region fields keep the key stable across pan/zoom (unlike pixel coords)
          key={`${highlight.assemblyName}_${highlight.refName}_${highlight.start}_${highlight.end}`}
          coords={coords}
          background={bandColor.toRgbString()}
          borderColor={(highlight.color ? bandColor : themed).toRgbString()}
          tooltip={highlight.label}
        />
      )
    })
})

export default OverviewHighlight
