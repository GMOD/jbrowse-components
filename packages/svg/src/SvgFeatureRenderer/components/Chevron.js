import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import { emphasize } from '@gmod/jbrowse-core/util/color'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'

function Chevron(props) {
  const { feature, config, featureLayout, selected } = props

  const width = Math.max(featureLayout.width, 1)
  const { top, left, height } = featureLayout

  const shapeProps = {
    title: feature.id(),
    'data-testid': feature.id(),
    transform: [-1, '-'].includes(feature.get('strand'))
      ? `rotate(180,${left + width / 2},${top + height / 2})`
      : undefined,
  }
  const color1 = readConfObject(config, 'color1', [feature])
  let emphasizedColor1
  try {
    emphasizedColor1 = emphasize(color1, 0.3)
  } catch (error) {
    emphasizedColor1 = color1
  }

  return width > height / 2 ? (
    <polygon
      {...shapeProps}
      stroke={selected ? 'black' : undefined}
      fill={selected ? emphasizedColor1 : color1}
      points={[
        [left, top],
        [left + width - height / 2, top],
        [left + width, top + height / 2],
        [left + width - height / 2, top + height],
        [left, top + height],
        [left + height / 2, top + height / 2],
      ]}
    />
  ) : (
    <polyline
      {...shapeProps}
      points={[
        [left, top],
        [left + width, top + height / 2],
        [left, top + height],
      ]}
      stroke={selected ? emphasizedColor1 : color1}
      fill="none"
    />
  )
}

Chevron.propTypes = {
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

Chevron.defaultProps = {
  selected: false,
}

export default observer(Chevron)
