import { readConfObject } from '@jbrowse/core/configuration'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'
import { chooseGlyphComponent, layOut, layOutFeature } from './util'

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
    getSubRecord: PropTypes.func.isRequired,
  }).isRequired,
  selected: PropTypes.bool,
  reversed: PropTypes.bool,
}

Subfeatures.defaultProps = {
  selected: false,
  reversed: false,
}

Subfeatures.layOut = ({ layout, feature, bpPerPx, reversed, config }) => {
  const subLayout = layOutFeature({
    layout,
    feature,
    bpPerPx,
    reversed,
    config,
  })
  const displayMode = readConfObject(config, 'displayMode')
  if (displayMode !== 'reducedRepresentation') {
    const subfeatures = feature.get('subfeatures') || []
    let topOffset = 0
    subfeatures.forEach(subfeature => {
      const SubfeatureGlyphComponent = chooseGlyphComponent(subfeature)
      const subfeatureHeight = readConfObject(config, 'height', {
        feature: subfeature,
      })

      const subSubLayout = (SubfeatureGlyphComponent.layOut || layOut)({
        layout: subLayout,
        feature: subfeature,
        bpPerPx,
        reversed,
        config,
      })
      subSubLayout.move(0, topOffset)
      topOffset +=
        displayMode === 'collapse'
          ? 0
          : (displayMode === 'compact'
              ? subfeatureHeight / 3
              : subfeatureHeight) + 2
    })
  }
  return subLayout
}

export default observer(Subfeatures)
