import { getSession, stringify } from '@jbrowse/core/util'
import { pxToBp } from '@jbrowse/core/util/Base1DUtils'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { GuideLabel } from '../../shared/coordLabels.tsx'

import type { LinearGenomeViewModel } from '../index.ts'
import type { ViewLayout } from '@jbrowse/core/util/Base1DUtils'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  guide: {
    pointerEvents: 'none',
    height: '100%',
    width: 1,
    position: 'absolute',
    left: 0,
  },
})

const OverviewRubberbandHoverTooltip = observer(
  function OverviewRubberbandHoverTooltip({
    model,
    guideX,
    overview,
  }: {
    model: LGV
    guideX: number
    overview: ViewLayout
  }) {
    const { classes } = useStyles()
    const { cytobandOffset } = model
    const { assemblyManager } = getSession(model)

    const px = pxToBp(overview, guideX - cytobandOffset)
    const assembly = assemblyManager.get(px.assemblyName)
    const cytoband = assembly?.cytobands?.find(
      f =>
        px.coord > f.get('start') &&
        px.coord < f.get('end') &&
        px.refName === assembly.getCanonicalRefName(f.get('refName')),
    )

    return (
      <>
        <GuideLabel
          coordX={guideX}
          viewWidth={overview.width}
          stickyTop={undefined}
        >
          {[stringify(px), cytoband?.get('name'), cytoband?.get('type')]
            .filter(Boolean)
            .join(' ')}
        </GuideLabel>
        <div
          className={classes.guide}
          style={{ transform: `translateX(${guideX}px)` }}
        />
      </>
    )
  },
)

export default OverviewRubberbandHoverTooltip
