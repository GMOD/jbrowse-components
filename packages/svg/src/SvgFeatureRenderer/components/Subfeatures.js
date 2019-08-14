import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'
import { chooseGlyphComponent, layOut } from './util'

function Subfeatures(props) {
  const { feature, featureLayout, selected } = props

  return (
    <>
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

Subfeatures.propTypes = {
  feature: PropTypes.shape({ get: PropTypes.func.isRequired }).isRequired,
  featureLayout: PropTypes.shape({
    top: PropTypes.number.isRequired,
    left: PropTypes.number.isRequired,
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
  }).isRequired,
  selected: PropTypes.bool,
}

Subfeatures.defaultProps = {
  selected: false,
  horizontallyFlipped: false,
}

Subfeatures.layOut = ({
  layout,
  feature,
  region,
  bpPerPx,
  horizontallyFlipped,
  config,
}) => {
  const GlyphComponent = chooseGlyphComponent(feature)
  const parentFeature = feature.parent()
  const x = parentFeature
    ? (feature.get('start') - parentFeature.get('start')) / bpPerPx
    : 0
  const height = readConfObject(config, 'height', [feature])
  const width = (feature.get('end') - feature.get('start')) / bpPerPx
  const layoutParent = layout.parent
  const top = layoutParent ? layoutParent.top : 0
  const subLayout = layout.addChild(
    String(feature.id()),
    x,
    top,
    width,
    height,
    { GlyphComponent },
  )
  const subfeatures = feature.get('subfeatures') || []
  let topOffset = 0
  subfeatures.forEach(subfeature => {
    const SubfeatureGlyphComponent = chooseGlyphComponent(subfeature)
    const subfeatureHeight = readConfObject(config, 'height', [subfeature])
    const subSubLayout = (SubfeatureGlyphComponent.layOut || layOut)({
      layout: subLayout,
      feature: subfeature,
      region,
      bpPerPx,
      horizontallyFlipped,
      config,
    })
    subSubLayout.move(0, topOffset)
    topOffset += subfeatureHeight + 2
  })
  return subLayout
}

export default observer(Subfeatures)
