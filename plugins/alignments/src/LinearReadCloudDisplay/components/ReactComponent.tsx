import React, { useCallback } from 'react'
import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

// local
import BaseDisplayComponent from '../../shared/components/BaseDisplayComponent'
import type { LinearReadCloudDisplayModel } from '../model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const Cloud = observer(function ({
  model,
}: {
  model: LinearReadCloudDisplayModel
}) {
  const view = getContainingView(model) as LGV
  const width = Math.round(view.dynamicBlocks.totalWidthPx)
  const height = model.height

  // biome-ignore lint/correctness/useExhaustiveDependencies:
  const cb = useCallback(
    (ref: HTMLCanvasElement) => {
      model.setRef(ref)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, width, height],
  )

  // note: the position absolute below avoids scrollbar from appearing on track
  return (
    <canvas
      data-testid="cloud-canvas"
      ref={cb}
      style={{ width, height, position: 'absolute' }}
      width={width * 2}
      height={height * 2}
    />
  )
})

const LinearReadCloudReactComponent = observer(function ({
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
export default LinearReadCloudReactComponent
