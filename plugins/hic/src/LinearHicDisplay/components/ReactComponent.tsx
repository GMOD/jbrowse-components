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

  return (
    <canvas
      data-testid="hic-canvas"
      ref={cb}
      style={{ width, height, position: 'absolute' }}
      width={width * 2}
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
