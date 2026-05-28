import { getSession, notEmpty } from '@jbrowse/core/util'
import { getLayoutHighlightCoords } from '@jbrowse/core/util/Base1DUtils'
import { colord } from '@jbrowse/core/util/colord'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import OverviewHighlightBand from './OverviewHighlightBand.tsx'

import type { LinearGenomeViewModel } from '../model.ts'
import type { SessionWithWidgets } from '@jbrowse/core/util'

type LGV = LinearGenomeViewModel

const OverviewHighlight = observer(function OverviewHighlight({
  model,
}: {
  model: LGV
}) {
  const theme = useTheme()
  const { highlight, cytobandOffset, overviewLayout: overview } = model
  const { assemblyManager } = getSession(model) as SessionWithWidgets

  return highlight
    .map(r => {
      const asm = r.assemblyName
        ? assemblyManager.get(r.assemblyName)
        : undefined
      const refName = asm?.getCanonicalRefName(r.refName) ?? r.refName
      const coords = getLayoutHighlightCoords(overview, { ...r, refName })
      return coords ? { coords, highlight: r } : undefined
    })
    .filter(notEmpty)
    .map(({ coords, highlight: r }, idx) => {
      const themed = colord(theme.palette.highlight.main)
      const bandColor = r.color ? colord(r.color) : themed.alpha(0.35)
      return (
        <OverviewHighlightBand
          /* biome-ignore lint/suspicious/noArrayIndexKey: */
          key={`${coords.left}_${coords.width}_${idx}`}
          coords={{ ...coords, left: coords.left + cytobandOffset }}
          background={bandColor.toRgbString()}
          borderColor={(r.color ? bandColor : themed).toRgbString()}
          tooltip={r.label}
        />
      )
    })
})

export default OverviewHighlight
