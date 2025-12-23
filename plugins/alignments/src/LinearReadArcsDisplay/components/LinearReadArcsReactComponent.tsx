import { useCallback } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import BaseDisplayComponent from '../../shared/components/BaseDisplayComponent'

import type { LinearReadArcsDisplayModel } from '../model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const Arcs = observer(function Arcs({
  model,
}: {
  model: LinearReadArcsDisplayModel
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
    <div style={{ position: 'relative', width, height }}>
      <canvas
        data-testid="arc-canvas"
        ref={cb}
        style={{ width, height, position: 'absolute' }}
        width={width * 2}
        height={height * 2}
      />
    </div>
  )
})

const LinearReadArcsReactComponent = observer(
  function LinearReadArcsReactComponent({
    model,
  }: {
    model: LinearReadArcsDisplayModel
  }) {
    return (
      <BaseDisplayComponent model={model}>
        <Arcs model={model} />
      </BaseDisplayComponent>
    )
  },
)

export default LinearReadArcsReactComponent
