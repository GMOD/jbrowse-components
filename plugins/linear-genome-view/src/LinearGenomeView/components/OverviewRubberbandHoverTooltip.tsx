import { getSession, stringify } from '@jbrowse/core/util'
import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import type { LinearGenomeViewModel } from '..'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  guide: {
    pointerEvents: 'none',
    height: '100%',
    width: 1,
    position: 'absolute',
  },
})

const OverviewRubberbandHoverTooltip = observer(function ({
  model,
  open,
  guideX,
  overview,
}: {
  model: LGV
  open: boolean
  guideX: number
  overview: Base1DViewModel
}) {
  const { classes } = useStyles()
  const { cytobandOffset } = model
  const { assemblyManager } = getSession(model)

  const px = overview.pxToBp(guideX - cytobandOffset)
  const assembly = assemblyManager.get(px.assemblyName)
  const cytoband = assembly?.cytobands?.find(
    f =>
      px.coord > f.get('start') &&
      px.coord < f.get('end') &&
      px.refName === assembly.getCanonicalRefName(f.get('refName')),
  )

  return (
    <Tooltip
      open={open}
      placement="top"
      title={[stringify(px), cytoband?.get('name'), cytoband?.get('type')].join(
        ' ',
      )}
      arrow
    >
      <div className={classes.guide} style={{ left: guideX }} />
    </Tooltip>
  )
})

export default OverviewRubberbandHoverTooltip
