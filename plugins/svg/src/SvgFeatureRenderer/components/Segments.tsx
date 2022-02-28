import React from 'react'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { emphasize } from '@jbrowse/core/util/color'
import { observer } from 'mobx-react'
import { Feature } from '@jbrowse/core/util/simpleFeature'

function Segments(props: {
  feature: Feature
  featureLayout: any
  selected: boolean
  config: AnyConfigurationModel
  reversed: boolean
  subfeatures?: Feature[]
  children?: React.ReactNode
}) {
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

  const subfeatures =
    subfeaturesProp || (feature.get('subfeatures') as Feature[])
  const color2 = readConfObject(config, 'color2', { feature })
  let emphasizedColor2
  try {
    emphasizedColor2 = emphasize(color2, 0.3)
  } catch (error) {
    emphasizedColor2 = color2
  }
  const { left, top, width, height } = featureLayout.absolute
  const strand = feature.get('strand')
  const arrowSize = 3
  const arrowOffset = 10
  const points = [
    [left, top + height / 2],
    [left + width + (strand ? arrowOffset : 0), top + height / 2],
  ]
  if (strand) {
    points.push(
      [left + width + arrowOffset / 2, top + height / 2 - arrowSize / 2],
      [left + width + arrowOffset / 2, top + height / 2 + arrowSize / 2],
      [left + width + arrowOffset, top + height / 2],
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
        points={points.toString()}
        stroke={selected ? emphasizedColor2 : color2}
      />
      {subfeatures?.map(subfeature => {
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
      })}
    </>
  )
}

export default observer(Segments)
