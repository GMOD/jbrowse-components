import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import { emphasize } from '@gmod/jbrowse-core/util/color'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'
import { chooseGlyphComponent } from './util'

function Segments(props) {
  const { feature, featureLayout, selected, bpPerPx, config } = props

  const color2 = readConfObject(config, 'color2', [feature])
  let emphasizedColor2
  try {
    emphasizedColor2 = emphasize(color2, 0.3)
  } catch (error) {
    emphasizedColor2 = color2
  }

  return (
    <>
      <line
        title={feature.id()}
        data-testid={feature.id()}
        x1={featureLayout.left}
        y1={featureLayout.top + featureLayout.height / 2}
        x2={featureLayout.left + featureLayout.width}
        y2={featureLayout.top + featureLayout.height / 2}
        stroke={selected ? emphasizedColor2 : color2}
      />
      {feature.get('subfeatures').map(subfeature => {
        const subfeatureId = String(subfeature.id())
        const GlyphComponent = chooseGlyphComponent(subfeature)
        const startPx =
          featureLayout.left +
          (subfeature.get('start') - feature.get('start')) / bpPerPx
        const endPx =
          startPx + (subfeature.get('end') - subfeature.get('start')) / bpPerPx
        featureLayout.addChild(
          subfeatureId,
          startPx,
          0,
          endPx - startPx,
          featureLayout.height,
        )
        const subfeatureLayout = featureLayout.getSubRecord(subfeatureId)
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
  bpPerPx: PropTypes.number.isRequired,
  config: CommonPropTypes.ConfigSchema.isRequired,
}

Segments.defaultProps = {
  selected: false,
  horizontallyFlipped: false,
}

export default observer(Segments)
