import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { PropTypes as CommonPropTypes } from '@gmod/jbrowse-core/mst-types'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import React, { MouseEvent } from 'react'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { BaseLayout } from '@gmod/jbrowse-core/util/layouts/BaseLayout'
import { AnyConfigurationModel } from '@gmod/jbrowse-core/configuration/configurationSchema'
import FeatureLabel from './FeatureLabel'
import { SvgFeatureRenderingProps } from './SvgFeatureRendering'

function FeatureGlyph(
  props: SvgFeatureRenderingProps & {
    feature: Feature
    rootLayout: any
    config: AnyConfigurationModel
    name: string
    shouldShowName: boolean
    shouldShowDescription: boolean
    description: string
    allowedWidthExpansion: number
    fontHeight: number
  },
) {
  const {
    regions,
    feature,
    rootLayout,
    config,
    name,
    shouldShowName,
    description,
    shouldShowDescription,
    fontHeight,
    allowedWidthExpansion,
  } = props
  const [region] = regions || []
  const { reversed } = region

  function onFeatureMouseDown(event: MouseEvent) {
    const { onFeatureMouseDown: handler } = props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  function onFeatureMouseEnter(event: MouseEvent) {
    const { onFeatureMouseEnter: handler } = props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  function onFeatureMouseOut(event: MouseEvent) {
    const { onFeatureMouseOut: handler } = props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  function onFeatureMouseOver(event: MouseEvent) {
    const { onFeatureMouseOver: handler } = props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  function onFeatureMouseUp(event: MouseEvent) {
    const { onFeatureMouseUp: handler } = props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  function onFeatureMouseLeave(event: MouseEvent) {
    const { onFeatureMouseLeave: handler } = props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  function onFeatureMouseMove(event: MouseEvent) {
    const { onFeatureMouseMove: handler } = props
    if (!handler) return undefined
    return handler(event, feature.id())
  }

  function onFeatureClick(event: MouseEvent) {
    const { onFeatureClick: handler } = props
    if (!handler) return undefined
    event.stopPropagation()
    return handler(event, feature.id())
  }

  const featureLayout = rootLayout.getSubRecord(String(feature.id()))
  const { GlyphComponent } = featureLayout.data

  const glyphComponents = [
    <GlyphComponent
      key={`glyph-${feature.id()}`}
      {...props}
      feature={feature}
      featureLayout={featureLayout}
    />,
  ]

  if (shouldShowName) {
    glyphComponents.push(
      <FeatureLabel
        reversed={reversed}
        key={`glyph-name-${feature.id()}`}
        text={name}
        x={rootLayout.getSubRecord('nameLabel').absolute.left}
        y={rootLayout.getSubRecord('nameLabel').absolute.top}
        color={readConfObject(config, ['labels', 'nameColor'], [feature])}
        fontHeight={fontHeight}
        featureWidth={featureLayout.width}
        allowedWidthExpansion={allowedWidthExpansion}
      />,
    )
  }

  if (shouldShowDescription) {
    glyphComponents.push(
      <FeatureLabel
        reversed={reversed}
        key={`glyph-description-${feature.id()}`}
        text={description}
        x={rootLayout.getSubRecord('descriptionLabel').absolute.left}
        y={rootLayout.getSubRecord('descriptionLabel').absolute.top}
        color={readConfObject(
          config,
          ['labels', 'descriptionColor'],
          [feature],
        )}
        fontHeight={fontHeight}
        featureWidth={featureLayout.width}
        allowedWidthExpansion={allowedWidthExpansion}
      />,
    )
  }

  return (
    <g
      onMouseDown={onFeatureMouseDown}
      onMouseEnter={onFeatureMouseEnter}
      onMouseOut={onFeatureMouseOut}
      onMouseOver={onFeatureMouseOver}
      onMouseUp={onFeatureMouseUp}
      onMouseLeave={onFeatureMouseLeave}
      onMouseMove={onFeatureMouseMove}
      onClick={onFeatureClick}
      // @ts-ignore
      onFocus={onFeatureMouseOver}
      // @ts-ignore
      onBlur={onFeatureMouseOut}
    >
      {glyphComponents}
    </g>
  )
}

export default observer(FeatureGlyph)
