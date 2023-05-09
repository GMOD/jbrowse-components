import React from 'react'
import { isAlive } from 'mobx-state-tree'
import { observer } from 'mobx-react'
import { getContainingView } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// local
import { LinearReadCloudDisplayModel } from '../model'
import BaseDisplayComponent from '../../shared/BaseDisplayComponent'

type LGV = LinearGenomeViewModel

const Cloud = observer(function ({
  model,
}: {
  model: LinearReadCloudDisplayModel
}) {
  const view = getContainingView(model) as LGV
  return (
    <canvas
      data-testid={`ReadCloud-display-${model.drawn}`}
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
  model: LinearReadCloudDisplayModel
}) {
  return (
    <BaseDisplayComponent model={model}>
      <Cloud model={model} />
    </BaseDisplayComponent>
  )
})
