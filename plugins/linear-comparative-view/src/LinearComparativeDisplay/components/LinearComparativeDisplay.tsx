import React from 'react'
import { observer } from 'mobx-react'

// locals
import { LinearComparativeDisplay } from '../stateModelFactory'

function Display(props: {
  model: LinearComparativeDisplay
  children?: React.ReactNode
}) {
  const { model, children } = props
  return (
    <div>
      {/* @ts-ignore */}
      <model.ReactComponent2 {...props} />
      {children}
    </div>
  )
}

export default observer(Display)
