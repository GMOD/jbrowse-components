import React from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import Tree from './Tree'

import type { MultiVariantBaseModel } from '../MultiVariantBaseModel'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { Instance } from 'mobx-state-tree'

const TreeSidebar = observer(function ({
  model,
}: {
  model: Instance<ReturnType<typeof MultiVariantBaseModel>>
}) {
  const { totalHeight, hierarchy } = model
  const { width } = getContainingView(model) as LinearGenomeViewModel

  if (!hierarchy) {
    return null
  }

  return (
    <svg
      style={{
        position: 'absolute',
        userSelect: 'none',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        height: totalHeight,
        width,
      }}
    >
      <Tree model={model} />
    </svg>
  )
})

export default TreeSidebar
