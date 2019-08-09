import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import { emphasize } from '@gmod/jbrowse-core/util/color'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'

function Box(props) {
  const { feature, config, featureLayout, selected } = props

  const color1 = readConfObject(config, 'color1', [feature])
  let emphasizedColor1
  try {
    emphasizedColor1 = emphasize(color1, 0.3)
  } catch (error) {
    emphasizedColor1 = color1
  }

  return (
    <rect
      title={feature.id()}
      data-testid={feature.id()}
      x={featureLayout.left}
      y={featureLayout.top}
      width={Math.max(featureLayout.width, 1)}
      height={featureLayout.height}
      fill={selected ? emphasizedColor1 : color1}
      stroke={selected ? 'black' : undefined}
    />
  )
}

Box.propTypes = {
  feature: ReactPropTypes.shape({ get: ReactPropTypes.func.isRequired })
    .isRequired,
  featureLayout: ReactPropTypes.shape({
    top: ReactPropTypes.number.isRequired,
    left: ReactPropTypes.number.isRequired,
    width: ReactPropTypes.number.isRequired,
    height: ReactPropTypes.number.isRequired,
  }).isRequired,
  selected: ReactPropTypes.bool,
  config: CommonPropTypes.ConfigSchema.isRequired,
}

Box.defaultProps = {
  selected: false,
}

export default observer(Box)
