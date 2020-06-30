import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/util/types/mst'
import { emphasize } from '@gmod/jbrowse-core/util/color'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'

function Box(props) {
  const { feature, region, config, featureLayout, selected, bpPerPx } = props
  const screenWidth = (region.end - region.start) / bpPerPx

  const color1 = readConfObject(config, 'color1', [feature])
  let emphasizedColor1
  try {
    emphasizedColor1 = emphasize(color1, 0.3)
  } catch (error) {
    emphasizedColor1 = color1
  }
  const color2 = readConfObject(config, 'color2', [feature])

  const { left, top, width, height } = featureLayout.absolute

  // clamp the SVG boxes to the current block area
  const x = Math.max(left, 0)
  const diff = x - left
  const w = width - diff

  // the below Math.min/Math.max 10000px limits are because SVG produces
  // silent non-rendered elements if it's like millions of px
  // renders -50000 to screenwidth (up to 100000) +50000
  return (
    <rect
      data-testid={feature.id()}
      x={x}
      y={top}
      width={Math.min(w, screenWidth)}
      height={height}
      fill={selected ? emphasizedColor1 : color1}
      stroke={selected ? color2 : undefined}
    />
  )
}

Box.propTypes = {
  feature: ReactPropTypes.shape({
    get: ReactPropTypes.func.isRequired,
    id: ReactPropTypes.func.isRequired,
  }).isRequired,
  region: CommonPropTypes.Region.isRequired,
  bpPerPx: ReactPropTypes.number.isRequired,
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
