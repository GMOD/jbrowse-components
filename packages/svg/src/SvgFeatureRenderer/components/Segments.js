import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import { emphasize } from '@gmod/jbrowse-core/util/color'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'

function Segments(props) {
  const { feature, featureLayout, selected, config } = props

  const color2 = readConfObject(config, 'color2', [feature])
  let emphasizedColor2
  try {
    emphasizedColor2 = emphasize(color2, 0.3)
  } catch (error) {
    emphasizedColor2 = color2
  }

  const { left, top, width, height } = featureLayout.absolute
  return (
    <>
      <line
        title={feature.id()}
        data-testid={feature.id()}
        x1={left}
        y1={top + height / 2}
        x2={left + width}
        y2={top + height / 2}
        stroke={selected ? emphasizedColor2 : color2}
      />
      {feature.get('subfeatures').map(subfeature => {
        const subfeatureId = String(subfeature.id())
        const subfeatureLayout = featureLayout.getSubRecord(subfeatureId)
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
      })}
    </>
  )
}

Segments.propTypes = {
  feature: PropTypes.shape({ get: PropTypes.func.isRequired }).isRequired,
  featureLayout: PropTypes.shape({
    top: PropTypes.number.isRequired,
    left: PropTypes.number.isRequired,
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
  }).isRequired,
  selected: PropTypes.bool,
  config: CommonPropTypes.ConfigSchema.isRequired,
}

Segments.defaultProps = {
  selected: false,
  horizontallyFlipped: false,
}

export default observer(Segments)
