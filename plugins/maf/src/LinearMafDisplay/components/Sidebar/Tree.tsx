import React from 'react'

import { observer } from 'mobx-react'

import type { LinearMafDisplayModel } from '../../stateModel'

const Tree = observer(function ({ model }: { model: LinearMafDisplayModel }) {
  const {
    // this is needed for redrawing after zoom change, similar to react-msaview
    // renderTreeCanvas
    // eslint-disable-next-line  @typescript-eslint/no-unused-vars
    rowHeight: _rowHeight,

    hierarchy,
    showBranchLen,
  } = model

  return (
    <>
      {hierarchy
        ? [...hierarchy.links()].map(link => {
            const { source, target } = link
            const sy = source.x!
            const ty = target.x!
            // @ts-expect-error
            const tx = showBranchLen ? target.len : target.y
            // @ts-expect-error
            const sx = showBranchLen ? source.len : source.y

            // 1d line intersection to check if line crosses block at all, this is
            // an optimization that allows us to skip drawing most tree links
            // outside the block
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
