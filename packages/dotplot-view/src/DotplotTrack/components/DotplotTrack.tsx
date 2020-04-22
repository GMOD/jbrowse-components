import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'
import { getContainingView } from '@gmod/jbrowse-core/util'
import { DotplotTrack as DotplotTrackModel } from '..'

const DotplotTrack: React.FC<{
  model: DotplotTrackModel
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
      <div
        style={{
          position: 'absolute',
          top,
          left,
        }}
      >
        <model.ReactComponent2 {...props} />
        {children}
      </div>
    </div>
  )
}
DotplotTrack.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
  children: PropTypes.element,
}

DotplotTrack.defaultProps = {
  children: null,
}
export default observer(DotplotTrack)
