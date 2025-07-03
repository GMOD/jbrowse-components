import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import type { DisplayModel } from './util'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'

const CanvasFeatureRendering = observer(function CanvasFeatureRendering(props: {
  layout: BaseLayout<unknown>
  blockKey: string
  regions: Region[]
  bpPerPx: number
  config: AnyConfigurationModel
  colorByCDS: boolean
  features: Map<string, Feature>
  displayModel?: DisplayModel
  width: number
  height: number
  exportSVG?: boolean
  viewParams: {
    start: number
    end: number
    offsetPx: number
    offsetPx1: number
  }
  featureDisplayHandler?: (f: Feature) => boolean
  onMouseOut?: React.MouseEventHandler
  onMouseDown?: React.MouseEventHandler
  onMouseLeave?: React.MouseEventHandler
  onMouseEnter?: React.MouseEventHandler
  onMouseOver?: React.MouseEventHandler
  onMouseMove?: (event: React.MouseEvent, featureId?: string) => void
  onMouseUp?: React.MouseEventHandler
  onClick?: React.MouseEventHandler
}) {
  return <PrerenderedCanvas {...props} />
})

export default CanvasFeatureRendering
