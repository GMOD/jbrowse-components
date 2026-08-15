import { getSession, stringify } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { GuideLabel } from '../../shared/coordLabels.tsx'
import { overviewPxToBp } from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { ViewLayout } from '@jbrowse/core/util/Base1DUtils'

type LGV = LinearGenomeViewModel

// Label only, no guide line: the overview already marks position with the
// visible-region box, and unlike the LGV/multi-level guides this one never had a
// background, so the 1px div it used to render painted nothing while still
// taking a transform patch per mousemove. Add a background here if a visible
// line is ever wanted.
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
    const { cytobandOffset } = model
    const { assemblyManager } = getSession(model)

    const px = overviewPxToBp(overview, guideX, cytobandOffset)
    const assembly = assemblyManager.get(px.assemblyName)
    const cytoband = assembly?.cytobands?.find(
      f =>
        px.coord > f.get('start') &&
        px.coord < f.get('end') &&
        px.refName === assembly.getCanonicalRefName2(f.get('refName')),
    )

    return (
      <GuideLabel
        coordX={guideX}
        viewWidth={overview.width}
        stickyTop={undefined}
      >
        {[stringify(px), cytoband?.get('name'), cytoband?.get('type')]
          .filter(Boolean)
          .join(' ')}
      </GuideLabel>
    )
  },
)

export default OverviewRubberbandHoverTooltip
