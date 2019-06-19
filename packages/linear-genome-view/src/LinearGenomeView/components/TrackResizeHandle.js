import React from 'react'
import ReactPropTypes from 'prop-types'

import ResizeHandleHorizontal from '@gmod/jbrowse-core/components/ResizeHandleHorizontal'

function TrackResizeHandle({ trackId, onVerticalDrag }) {
  return (
    <ResizeHandleHorizontal
      objectId={trackId}
      onVerticalDrag={onVerticalDrag}
      style={{
        gridRow: `resize-${trackId}`,
        gridColumn: 'span 2',
      }}
    />
  )
}

TrackResizeHandle.propTypes = {
  trackId: ReactPropTypes.string.isRequired,
  onVerticalDrag: ReactPropTypes.func.isRequired,
}

export default TrackResizeHandle
