import { getType, isStateTreeNode } from '@jbrowse/mobx-state-tree'
import { observer } from 'mobx-react'

const HeadingComponent = observer(function ({
  model,
}: {
  model?: {
    target?: { type: string }
    effectiveTarget?: { type: string }
  }
}) {
  // Use effectiveTarget if available (for frozen configs), otherwise target
  const target = model?.effectiveTarget ?? model?.target
  if (target) {
    if (target.type) {
      return `${target.type} settings`
    }
    if (isStateTreeNode(target)) {
      const type = getType(target)
      if (type.name) {
        return `${type.name.replace('ConfigurationSchema', '')} settings`
      }
    }
  }
  return <>Settings</>
})

export default HeadingComponent
