import { useCallback } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import BaseDisplayComponent from './BaseDisplayComponent'

import type { LinearHicDisplayModel } from '../model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const HicCanvas = observer(function ({
  model,
}: {
  model: LinearHicDisplayModel
}) {
  const view = getContainingView(model) as LGV
  const screenWidth = Math.round(view.dynamicBlocks.totalWidthPx)
  const { offsetPx } = view
  const height = model.height

  // Adjust canvas width and position when offsetPx is negative
  const canvasWidth = offsetPx < 0 ? screenWidth + offsetPx : screenWidth
  const canvasLeft = offsetPx < 0 ? -offsetPx : 0

  // biome-ignore lint/correctness/useExhaustiveDependencies:
  const cb = useCallback(
    (ref: HTMLCanvasElement) => {
      model.setRef(ref)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, canvasWidth, height],
  )

  return (
    <canvas
      data-testid="hic-canvas"
      ref={cb}
      style={{
        width: canvasWidth,
        height,
        position: 'absolute',
        left: canvasLeft,
      }}
      width={canvasWidth * 2}
      height={height * 2}
    />
  )
})

const LinearHicReactComponent = observer(function ({
  model,
}: {
  model: LinearHicDisplayModel
}) {
  return (
    <BaseDisplayComponent model={model}>
      <HicCanvas model={model} />
    </BaseDisplayComponent>
  )
})

export default LinearHicReactComponent
