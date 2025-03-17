import { observer } from 'mobx-react'

import RenderedFeatureGlyph from './RenderedFeatureGlyph'

import type { DisplayModel, ExtraGlyphValidator, ViewParams } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'

const RenderedFeatures = observer(function RenderedFeatures(props: {
  features?: Map<string, Feature>
  isFeatureDisplayed?: (f: Feature) => boolean
  bpPerPx: number
  config: AnyConfigurationModel
  displayMode: string
  colorByCDS: boolean
  displayModel?: DisplayModel
  region: Region
  exportSVG?: unknown
  extraGlyphs?: ExtraGlyphValidator[]
  layout: BaseLayout<unknown>
  viewParams: ViewParams
  [key: string]: unknown
}) {
  const { features = new Map(), isFeatureDisplayed } = props
  return (
    <>
      {[...features.values()]
        .filter(feature =>
          isFeatureDisplayed ? isFeatureDisplayed(feature) : true,
        )
        .map(feature => (
          <RenderedFeatureGlyph
            key={feature.id()}
            feature={feature}
            {...props}
          />
        ))}
    </>
  )
})

export default RenderedFeatures
