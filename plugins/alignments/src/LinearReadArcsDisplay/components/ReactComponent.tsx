import React from 'react'
import { isAlive } from 'mobx-state-tree'
import { observer } from 'mobx-react'
import { getContainingView } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// local
import { LinearReadArcsDisplayModel } from '../model'
import BaseDisplayComponent from '../../shared/BaseDisplayComponent'

type LGV = LinearGenomeViewModel

const Arcs = observer(function ({
  model,
}: {
  model: LinearReadArcsDisplayModel
}) {
  const view = getContainingView(model) as LGV
  return (
    <canvas
      data-testid={`Arc-display-${model.drawn}`}
      ref={ref => {
        if (isAlive(model)) {
          model.setRef(ref)
        }
      }}
      style={{
        position: 'absolute',
        left: -view.offsetPx + model.lastDrawnOffsetPx,
        width: view.dynamicBlocks.totalWidthPx,
        height: model.height,
      }}
      width={view.dynamicBlocks.totalWidthPx * 2}
      height={model.height * 2}
    />
  )
})

export default observer(function ({
  model,
}: {
  model: LinearReadArcsDisplayModel
}) {
  return (
    <BaseDisplayComponent model={model}>
      <Arcs model={model} />
    </BaseDisplayComponent>
  )
})
