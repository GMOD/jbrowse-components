import React from 'react'
import { isAlive } from 'mobx-state-tree'
import { observer } from 'mobx-react'
import { getContainingView } from '@jbrowse/core/util'
import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// local
import { LinearAlignmentsCloudDisplayModel } from '../model'

type LGV = LinearGenomeViewModel

const height = 1200

const Cloud = observer(function ({
  model,
}: {
  model: LinearAlignmentsCloudDisplayModel
}) {
  const view = getContainingView(model) as LGV
  return (
    <canvas
      ref={ref => {
        if (isAlive(model)) {
          model.setRef(ref)
        }
      }}
      style={{
        position: 'absolute',
        left: -view.offsetPx + model.lastDrawnOffsetPx,
        width: view.dynamicBlocks.totalWidthPx,
      }}
      width={view.dynamicBlocks.totalWidthPx * 2}
      height={height * 2}
    />
  )
})

export default observer(function ({
  model,
}: {
  model: LinearAlignmentsCloudDisplayModel
}) {
  return model.error ? (
    <ErrorMessage error={model.error} />
  ) : model.loading ? (
    <LoadingEllipses />
  ) : (
    <Cloud model={model} />
  )
})
