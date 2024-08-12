import React from 'react'
import { observer } from 'mobx-react'
import { isStateTreeNode, getType } from 'mobx-state-tree'

const HeadingComponent = observer(function ({
  model,
}: {
  model?: {
    target: {
      type: string
    }
  }
}) {
  if (model?.target) {
    if (model.target.type) {
      return `${model.target.type} settings`
    }
    if (isStateTreeNode(model.target)) {
      const type = getType(model.target)
      if (type.name) {
        return `${type.name.replace('ConfigurationSchema', '')} settings`
      }
    }
  }
  return <>Settings</>
})

export default HeadingComponent
