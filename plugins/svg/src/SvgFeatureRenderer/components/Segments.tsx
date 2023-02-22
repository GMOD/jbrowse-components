import React from 'react'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { observer } from 'mobx-react'
import { SceneGraph } from '@jbrowse/core/util/layouts'
import { Region, Feature } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

// locals
import Arrow from './Arrow'

function Segments(props: {
  region: Region
  feature: Feature
  featureLayout: SceneGraph
  config: AnyConfigurationModel
  selected?: boolean
  reversed?: boolean
  subfeatures?: Feature[]
  children?: React.ReactNode
}) {
  const {
    feature,
    featureLayout,
    selected,
    config,
    // some subfeatures may be computed e.g. makeUTRs,
    // so these are passed as a prop, or feature.get('subfeatures') by default
    subfeatures = feature.get('subfeatures'),
  } = props

  const theme = useTheme()
  const c = readConfObject(config, 'color2', { feature })
  const color2 = c === '#f0f' ? theme.palette.text.secondary : c

  const { left = 0, top = 0, width = 0, height = 0 } = featureLayout.absolute

  const y = top + height / 2
  return (
    <>
      <line
        data-testid={feature.id()}
        x1={left}
        y1={y}
        y2={y}
        x2={left + width}
        stroke={color2}
      />
      {subfeatures?.map(subfeature => {
        const subfeatureId = String(subfeature.id())
        const subfeatureLayout = featureLayout.getSubRecord(subfeatureId)
        // This subfeature got filtered out
        if (!subfeatureLayout) {
          return null
        }
        const { GlyphComponent } = subfeatureLayout.data || {}
        return (
          <GlyphComponent
            key={`glyph-${subfeatureId}`}
            {...props}
            feature={subfeature}
            topLevel={false}
            featureLayout={subfeatureLayout}
            selected={selected}
          />
        )
      })}
      <Arrow {...props} />
    </>
  )
}

export default observer(Segments)
