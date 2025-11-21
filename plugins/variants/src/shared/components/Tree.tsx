import React from 'react'

import { observer } from 'mobx-react'

import type { MultiVariantBaseModel } from '../MultiVariantBaseModel'
import type { Instance } from 'mobx-state-tree'

const Tree = observer(function ({
  model,
}: {
  model: Instance<ReturnType<typeof MultiVariantBaseModel>>
}) {
  const { rowHeight: _rowHeight, hierarchy } = model

  return (
    <>
      {hierarchy
        ? [...hierarchy.links()].map(link => {
            const { source, target } = link
            const sy = source.x!
            const ty = target.x!
            const tx = target.y
            const sx = source.y

            return (
              <React.Fragment key={[sy, ty, tx, sx].join('-')}>
                <line stroke="black" x1={sx} y1={sy} x2={sx} y2={ty} />
                <line stroke="black" x1={sx} y1={ty} x2={tx} y2={ty} />
              </React.Fragment>
            )
          })
        : null}
    </>
  )
})

export default Tree
