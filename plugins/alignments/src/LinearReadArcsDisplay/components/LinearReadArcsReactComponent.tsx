import { useCallback } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import BaseDisplayComponent from '../../shared/components/BaseDisplayComponent'

import type { LinearReadArcsDisplayModel } from '../model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const Arcs = observer(function ({
  model,
}: {
  model: LinearReadArcsDisplayModel
}) {
  const view = getContainingView(model) as LGV
  const screenWidth = Math.round(view.dynamicBlocks.totalWidthPx)
  const offsetPx = view.offsetPx

  // Adjust canvas width and position when offsetPx is negative
  // This ensures drawing code doesn't need to account for negative offsets
  const canvasWidth = offsetPx < 0 ? screenWidth + offsetPx : screenWidth
  const canvasLeft = offsetPx < 0 ? -offsetPx : 0

  const width = screenWidth // Keep container full width
  const height = model.height
  // biome-ignore lint/correctness/useExhaustiveDependencies:
  const cb = useCallback(
    (ref: HTMLCanvasElement) => {
      model.setRef(ref)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, canvasWidth, height],
  )

  // note: the position absolute below avoids scrollbar from appearing on track
  return (
    <div style={{ position: 'relative', width, height }}>
      <canvas
        data-testid="arc-canvas"
        ref={cb}
        style={{
          width: canvasWidth,
          height,
          position: 'absolute',
          left: canvasLeft,
          top: 0,
        }}
        width={canvasWidth * 2}
        height={height * 2}
      />
    </div>
  )
})

const LinearReadArcsReactComponent = observer(function ({
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

export default LinearReadArcsReactComponent
