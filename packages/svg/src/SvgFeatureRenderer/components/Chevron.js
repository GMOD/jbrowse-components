import { doesIntersect2 } from '@gmod/jbrowse-core/util/range'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import { emphasize } from '@gmod/jbrowse-core/util/color'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'
import { isUTR } from './util'

const utrHeightFraction = 0.65

function Chevron(props) {
  const {
    feature,
    config,
    region,
    featureLayout,
    selected,
    horizontallyFlipped,
  } = props

  const width = Math.max(featureLayout.absolute.width, 1)
  const { left } = featureLayout.absolute
  let { top, height } = featureLayout.absolute
  if (isUTR(feature)) {
    top += ((1 - utrHeightFraction) / 2) * height
    height *= utrHeightFraction
  }

  const strand = feature.get('strand')
  const direction = strand * (horizontallyFlipped ? -1 : 1)

  const shapeProps = {
    'data-testid': feature.id(),
    transform:
      direction < 0
        ? `rotate(180,${left + width / 2},${top + height / 2})`
        : undefined,
  }

  const color = isUTR(feature)
    ? readConfObject(config, 'color3', [feature])
    : readConfObject(config, 'color1', [feature])
  let emphasizedColor
  try {
    emphasizedColor = emphasize(color, 0.3)
  } catch (error) {
    emphasizedColor = color
  }
  const color2 = readConfObject(config, 'color2', [feature])

  // To restore indents on back of Chevron: un-comment the last point in the
  // first polygon and replace the second polygon with the commented-out polyline
  if (
    !doesIntersect2(
      feature.get('start'),
      feature.get('end'),
      region.start,
      region.end,
    )
  )
    return null
  return width > height / 2 ? (
    <polygon
      {...shapeProps}
      stroke={selected ? color2 : undefined}
      fill={selected ? emphasizedColor : color}
      points={[
        [left, top],
        [left + width - height / 2, top],
        [left + width, top + height / 2],
        [left + width - height / 2, top + height],
        [left, top + height],
        // [left + height / 2, top + height / 2],
      ]}
    />
  ) : (
    <polygon
      {...shapeProps}
      fill={selected ? emphasizedColor : color}
      points={[
        [left, top],
        [left + width, top + height / 2],
        [left, top + height],
      ]}
      stroke={selected ? emphasizedColor : color}
    />
    // <polyline
    //   {...shapeProps}
    //   points={[
    //     [left, top],
    //     [left + width, top + height / 2],
    //     [left, top + height],
    //   ]}
    //   stroke={selected ? emphasizedColor : color}
    //   fill="none"
    // />
  )
}

Chevron.propTypes = {
  feature: ReactPropTypes.shape({
    id: ReactPropTypes.func.isRequired,
    get: ReactPropTypes.func.isRequired,
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
  horizontallyFlipped: ReactPropTypes.bool,
}

Chevron.defaultProps = {
  selected: false,
  horizontallyFlipped: false,
}

export default observer(Chevron)
