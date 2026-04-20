import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import SVChordsReactComponent from '@jbrowse/plugin-circular-view/src/ChordRenderer/ReactComponent.tsx'
import DisplayError from './DisplayError.tsx'
import Loading from './Loading.tsx'

import type { MouseEvent } from 'react'

import type { AnyRegion, Block } from '@jbrowse/plugin-circular-view'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { CircularViewModel } from '@jbrowse/plugin-circular-view'

interface DisplayModel {
  id: string
  filled: boolean
  error: unknown
  features: Map<string, Feature> | undefined
  blockDefinitions: Block[]
  selectedFeatureId: string | undefined
  configuration: { renderer: AnyConfigurationModel }
  bezierRadiusRatio: number
  onChordClick: (
    feature: Feature,
    reg: AnyRegion,
    endBlock: AnyRegion,
    evt: MouseEvent<SVGPathElement>,
  ) => void
}

const ChordVariantDisplay = observer(function ChordVariantDisplay({
  display,
}: {
  display: DisplayModel
}) {
  const view = getContainingView(display) as CircularViewModel
  const radius = view.radiusPx

  if (display.error) {
    return <DisplayError model={display} radius={radius} />
  }
  if (!display.filled || !display.features) {
    return <Loading radius={radius} />
  }

  return (
    <SVChordsReactComponent
      features={display.features}
      blockDefinitions={display.blockDefinitions}
      radius={radius}
      bezierRadius={radius * display.bezierRadiusRatio}
      config={display.configuration.renderer}
      displayModel={display}
      onChordClick={display.onChordClick}
    />
  )
})

export default ChordVariantDisplay
