import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'
import { getContainingView } from '@jbrowse/core/util'
import { DotplotDisplayModel } from '..'

const DotplotDisplay: React.FC<{
  model: DotplotDisplayModel
  children?: React.ReactNode
}> = props => {
  const { model, children } = props
  const { offsetX = 0, offsetY = 0 } = model.data || {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const view = getContainingView(model) as any
  const top = view.vview.offsetPx - offsetY
  const left = -(view.hview.offsetPx - offsetX)
  return (
    <div style={{ position: 'relative' }}>
      <model.ReactComponent2
        {...props}
        style={{
          position: 'absolute',
          top,
          left,
        }}
      />
      {children}
    </div>
  )
}
DotplotDisplay.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
  children: PropTypes.element,
}

DotplotDisplay.defaultProps = {
  children: null,
}
export default observer(DotplotDisplay)
