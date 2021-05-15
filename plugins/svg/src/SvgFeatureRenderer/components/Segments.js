import { readConfObject } from '@jbrowse/core/configuration'
import { PropTypes as CommonPropTypes } from '@jbrowse/core/util/types/mst'
import { emphasize } from '@jbrowse/core/util/color'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'

function Segments(props) {
  const {
    feature,
    featureLayout,
    selected,
    config,
    reversed,
    // some subfeatures may be computed e.g. makeUTRs,
    // so these are passed as a prop
    // eslint-disable-next-line react/prop-types
    subfeatures: subfeaturesProp,
  } = props

  const subfeatures = subfeaturesProp || feature.get('subfeatures')
  const color2 = readConfObject(config, 'color2', { feature })
  let emphasizedColor2
  try {
    emphasizedColor2 = emphasize(color2, 0.3)
  } catch (error) {
    emphasizedColor2 = color2
  }
  const { left, top, width, height } = featureLayout.absolute
  const points = [
    [left, top + height / 2],
    [left + width, top + height / 2],
  ]
  const strand = feature.get('strand')
  if (strand) {
    points.push(
      [left + width - height / 4, top + height / 4],
      [left + width - height / 4, top + 3 * (height / 4)],
      [left + width, top + height / 2],
    )
  }

  return (
    <>
      <polyline
        data-testid={feature.id()}
        transform={
          strand && ((!reversed && strand < 0) || (reversed && strand > 0))
            ? `rotate(180,${left + width / 2},${top + height / 2})`
            : undefined
        }
        points={points}
        stroke={selected ? emphasizedColor2 : color2}
      />
      {
        // eslint-disable-next-line react/prop-types
        subfeatures.map(subfeature => {
          const subfeatureId = String(subfeature.id())
          const subfeatureLayout = featureLayout.getSubRecord(subfeatureId)
          // This subfeature got filtered out
          if (!subfeatureLayout) {
            return null
          }
          const { GlyphComponent } = subfeatureLayout.data
          return (
            <GlyphComponent
              key={`glyph-${subfeatureId}`}
              {...props}
              feature={subfeature}
              featureLayout={subfeatureLayout}
              selected={selected}
            />
          )
        })
      }
    </>
  )
}

Segments.propTypes = {
  feature: PropTypes.shape({
    id: PropTypes.func.isRequired,
    get: PropTypes.func.isRequired,
  }).isRequired,
  featureLayout: PropTypes.shape({
    absolute: PropTypes.shape({
      top: PropTypes.number.isRequired,
      left: PropTypes.number.isRequired,
      width: PropTypes.number.isRequired,
      height: PropTypes.number.isRequired,
    }),
    getSubRecord: PropTypes.func.isRequired,
  }).isRequired,
  selected: PropTypes.bool,
  config: CommonPropTypes.ConfigSchema.isRequired,
  reversed: PropTypes.bool,
}

Segments.defaultProps = {
  selected: false,
  reversed: false,
}

export default observer(Segments)
