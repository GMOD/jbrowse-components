import { emphasize } from '@gmod/jbrowse-core/util/color'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'
import { chooseGlyphComponent } from './util'

function Segments(props) {
  const { feature, featureLayout, selected, bpPerPx } = props

  return (
    <>
      <line
        title={feature.id()}
        data-testid={feature.id()}
        x1={featureLayout.left}
        y1={featureLayout.top + featureLayout.height / 2}
        x2={featureLayout.left + featureLayout.width}
        y2={featureLayout.top + featureLayout.height / 2}
        stroke={selected ? 'black' : emphasize('black', 0.3)}
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
}

Segments.defaultProps = {
  selected: false,
  horizontallyFlipped: false,
}

export default observer(Segments)
