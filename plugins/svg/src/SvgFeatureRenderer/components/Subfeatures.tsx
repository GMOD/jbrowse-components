import { readConfObject } from '@jbrowse/core/configuration'
import { measureText } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import FeatureLabel from './FeatureLabel'
import { chooseGlyphComponent, layOut, layOutFeature } from './util'

import type { DisplayModel, ExtraGlyphValidator, ViewParams } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { SceneGraph } from '@jbrowse/core/util/layouts'
import type { Feature } from '@jbrowse/core/util/simpleFeature'

const Subfeatures = observer(function Subfeatures(props: {
  feature: Feature
  featureLayout: SceneGraph
  selected?: boolean
  config: AnyConfigurationModel
  bpPerPx: number
  region: Region
  displayModel?: DisplayModel
  exportSVG?: unknown
  viewParams: ViewParams
  allowedWidthExpansion?: number
  reversed?: boolean
}) {
  const {
    feature,
    featureLayout,
    selected,
    config,
    bpPerPx,
    region,
    displayModel,
    exportSVG,
    viewParams,
    allowedWidthExpansion = 0,
    reversed,
  } = props

  const displayMode = readConfObject(config, 'displayMode')
  const labelAllowed = displayMode !== 'collapsed'

  return feature.get('subfeatures')?.map(subfeature => {
    // bad or old code might not be a string id but try to assume it is

    const subfeatureId = String(subfeature.id())
    const subfeatureLayout = featureLayout.getSubRecord(subfeatureId)
    if (!subfeatureLayout) {
      return null
    }
    const { GlyphComponent } = subfeatureLayout.data || {}

    // Calculate label information for subfeatures
    const showLabels = labelAllowed && readConfObject(config, 'showLabels')
    const showDescriptions =
      labelAllowed && readConfObject(config, 'showDescriptions')
    const fontHeight = readConfObject(config, ['labels', 'fontSize'], {
      feature: subfeature,
    })

    const name = String(
      readConfObject(config, ['labels', 'name'], { feature: subfeature }) || '',
    )
    const shouldShowName = /\S/.test(name) && showLabels

    const description = String(
      readConfObject(config, ['labels', 'description'], {
        feature: subfeature,
      }) || '',
    )
    const shouldShowDescription = /\S/.test(description) && showDescriptions

    return (
      <g key={`glyph-${subfeatureId}`}>
        <GlyphComponent
          {...props}
          feature={subfeature}
          featureLayout={subfeatureLayout}
          selected={selected}
        />
        {shouldShowName ? (
          <FeatureLabel
            text={name}
            x={
              featureLayout.getSubRecord(`${subfeatureId}-nameLabel`)?.absolute
                .left || 0
            }
            y={
              featureLayout.getSubRecord(`${subfeatureId}-nameLabel`)?.absolute
                .top || 0
            }
            color={readConfObject(config, ['labels', 'nameColor'], {
              feature: subfeature,
            })}
            featureWidth={subfeatureLayout.width}
            fontHeight={fontHeight}
            allowedWidthExpansion={allowedWidthExpansion}
            bpPerPx={bpPerPx}
            feature={subfeature}
            reversed={reversed}
            displayModel={displayModel}
            exportSVG={exportSVG}
            region={region}
            viewParams={viewParams}
          />
        ) : null}
        {shouldShowDescription ? (
          <FeatureLabel
            text={description}
            x={
              featureLayout.getSubRecord(`${subfeatureId}-descriptionLabel`)
                ?.absolute.left || 0
            }
            y={
              featureLayout.getSubRecord(`${subfeatureId}-descriptionLabel`)
                ?.absolute.top || 0
            }
            color={readConfObject(config, ['labels', 'descriptionColor'], {
              feature: subfeature,
            })}
            featureWidth={subfeatureLayout.width}
            fontHeight={fontHeight}
            allowedWidthExpansion={allowedWidthExpansion}
            bpPerPx={bpPerPx}
            feature={subfeature}
            reversed={reversed}
            displayModel={displayModel}
            exportSVG={exportSVG}
            region={region}
            viewParams={viewParams}
          />
        ) : null}
      </g>
    )
  })
})

// @ts-expect-error
Subfeatures.layOut = ({
  layout,
  feature,
  bpPerPx,
  reversed,
  config,
  extraGlyphs,
}: {
  layout: SceneGraph
  feature: Feature
  bpPerPx: number
  reversed: boolean
  config: AnyConfigurationModel
  extraGlyphs: ExtraGlyphValidator[]
}) => {
  const subLayout = layOutFeature({
    layout,
    feature,
    bpPerPx,
    reversed,
    config,
    extraGlyphs,
  })
  const displayMode = readConfObject(config, 'displayMode')
  if (displayMode !== 'reducedRepresentation') {
    let topOffset = 0
    const subfeatures = feature.get('subfeatures')
    const labelAllowed = displayMode !== 'collapsed'
    const showLabels = labelAllowed && readConfObject(config, 'showLabels')
    const showDescriptions =
      labelAllowed && readConfObject(config, 'showDescriptions')
    const expansion = readConfObject(config, 'maxFeatureGlyphExpansion') || 0

    if (subfeatures) {
      for (const subfeature of subfeatures) {
        const subfeatureId = String(subfeature.id())
        const SubfeatureGlyphComponent = chooseGlyphComponent({
          feature: subfeature,
          extraGlyphs,
          config,
        })
        const subfeatureHeight = readConfObject(config, 'height', {
          feature: subfeature,
        }) as number

        const subSubLayout = (SubfeatureGlyphComponent.layOut || layOut)({
          layout: subLayout,
          feature: subfeature,
          bpPerPx,
          reversed,
          config,
          extraGlyphs,
        })
        subSubLayout.move(0, topOffset)

        // Store the original height of the glyph before any modifications
        const glyphBottom = topOffset + subSubLayout.height

        // Add label layouts at the subLayout level (not as children of subSubLayout)
        // This prevents them from affecting the glyph's height calculations
        const fontHeight = readConfObject(config, ['labels', 'fontSize'], {
          feature: subfeature,
        })
        const name = String(
          readConfObject(config, ['labels', 'name'], { feature: subfeature }) ||
            '',
        )
        const shouldShowName = /\S/.test(name) && showLabels
        const description = String(
          readConfObject(config, ['labels', 'description'], {
            feature: subfeature,
          }) || '',
        )
        const shouldShowDescription = /\S/.test(description) && showDescriptions

        const getWidth = (text: string) => {
          const glyphWidth = subSubLayout.width + expansion
          const textWidth = measureText(text, fontHeight)
          return Math.round(Math.min(textWidth, glyphWidth))
        }

        let labelY = glyphBottom
        if (shouldShowName) {
          subLayout.addChild(
            `${subfeatureId}-nameLabel`,
            0,
            labelY,
            getWidth(name),
            fontHeight,
          )
          labelY += fontHeight
        }

        if (shouldShowDescription) {
          subLayout.addChild(
            `${subfeatureId}-descriptionLabel`,
            0,
            labelY,
            getWidth(description),
            fontHeight,
          )
          labelY += fontHeight
        }

        topOffset +=
          displayMode === 'collapse'
            ? 0
            : (displayMode === 'compact'
                ? subfeatureHeight / 3
                : subfeatureHeight) + 2

        // Add space for labels
        if (shouldShowName) {
          topOffset += fontHeight
        }
        if (shouldShowDescription) {
          topOffset += fontHeight
        }
      }
    }
  }
  return subLayout
}

export default Subfeatures
