import { readConfObject } from '@jbrowse/core/configuration'
import { PropTypes as CommonPropTypes } from '@jbrowse/core/util/types/mst'
import { emphasize } from '@jbrowse/core/util/color'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'

function Box(props) {
  const { feature, region, config, featureLayout, selected, bpPerPx } = props
  const screenWidth = (region.end - region.start) / bpPerPx

  const color1 = readConfObject(config, 'color1', { feature })
  let emphasizedColor1
  try {
    emphasizedColor1 = emphasize(color1, 0.3)
  } catch (error) {
    emphasizedColor1 = color1
  }
  const color2 = readConfObject(config, 'color2', { feature })

  const { left, top, width, height } = featureLayout.absolute

  if (left + width < 0) {
    return null
  }
  const leftWithinBlock = Math.max(left, 0)
  const diff = leftWithinBlock - left
  const widthWithinBlock = Math.max(1, Math.min(width - diff, screenWidth))

  return (
    <rect
      data-testid={`box-${feature.id()}`}
      x={leftWithinBlock}
      y={top}
      width={widthWithinBlock}
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
