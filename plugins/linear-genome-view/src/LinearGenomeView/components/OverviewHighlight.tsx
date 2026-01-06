import { getSession, notEmpty } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../model.ts'
import type { SessionWithWidgets } from '@jbrowse/core/util'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(theme => ({
  highlight: {
    height: '100%',
    position: 'absolute',
    left: 0,
    background: colord(theme.palette.highlight.main).alpha(0.35).toRgbString(),
    borderLeft: `1px solid ${theme.palette.highlight.main}`,
    borderRight: `1px solid ${theme.palette.highlight.main}`,
  },
}))

const OverviewHighlight = observer(function OverviewHighlight({
  model,
  overview,
}: {
  model: LGV
  overview: Base1DViewModel
}) {
  const { classes } = useStyles()
  const { highlight, cytobandOffset } = model

  const session = getSession(model) as SessionWithWidgets
  const { assemblyManager } = session
  return highlight
    .map(r => {
      const asm = assemblyManager.get(r.assemblyName)
      const refName = asm?.getCanonicalRefName(r.refName) ?? r.refName
      const s = overview.bpToPx({
        ...r,
        refName,
        coord: r.start,
      })
      const e = overview.bpToPx({
        ...r,
        refName,
        coord: r.end,
      })
      return s !== undefined && e !== undefined
        ? {
            width: Math.abs(e - s),
            left: s + cytobandOffset,
          }
        : undefined
    })
    .filter(notEmpty)
    .map(({ left, width }, idx) => (
      <div
        /* biome-ignore lint/suspicious/noArrayIndexKey: */
        key={`${left}_${width}_${idx}`}
        className={classes.highlight}
        style={{
          width,
          transform: `translateX(${left}px)`,
        }}
      />
    ))
})

export default OverviewHighlight
