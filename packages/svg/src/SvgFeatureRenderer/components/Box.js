import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { doesIntersect2 } from '@gmod/jbrowse-core/util/range'
import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import { emphasize } from '@gmod/jbrowse-core/util/color'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'

function Box(props) {
  const { feature, config, featureLayout, selected, region, bpPerPx } = props
  const totalWidth = (region.end - region.start) / bpPerPx

  const color1 = readConfObject(config, 'color1', [feature])
  let emphasizedColor1
  try {
    emphasizedColor1 = emphasize(color1, 0.3)
  } catch (error) {
    emphasizedColor1 = color1
  }
  const color2 = readConfObject(config, 'color2', [feature])

  const { left, top, width, height } = featureLayout.absolute

  // the below Math.min/Math.max 10000px limits are because SVG produces
  // silent non-rendered elements if it's like millions of px
  // renders -50000 to screenwidth (up to 100000) +50000

  return doesIntersect2(
    feature.get('start'),
    feature.get('end'),
    region.start,
    region.end,
  ) ? (
    <rect
      data-testid={feature.id()}
      x={Math.max(left, -50000)}
      y={top}
      width={Math.min(Math.max(width, 1), 200000)}
      height={height}
      fill={selected ? emphasizedColor1 : color1}
      stroke={selected ? color2 : undefined}
    />
  ) : null
}

Box.propTypes = {
  feature: ReactPropTypes.shape({
    get: ReactPropTypes.func.isRequired,
    id: ReactPropTypes.func.isRequired,
  }).isRequired,
  featureLayout: ReactPropTypes.shape({
    absolute: ReactPropTypes.shape({
      top: ReactPropTypes.number.isRequired,
      left: ReactPropTypes.number.isRequired,
      width: ReactPropTypes.number.isRequired,
      height: ReactPropTypes.number.isRequired,
    }),
  }).isRequired,
  selected: ReactPropTypes.bool,
  config: CommonPropTypes.ConfigSchema.isRequired,
}

Box.defaultProps = {
  selected: false,
}

export default observer(Box)
