import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import SVChordsReactComponent from '../../StructuralVariantChordRenderer/ReactComponent.tsx'
import DisplayError from './DisplayError.tsx'
import Loading from './Loading.tsx'

import type { Block } from '../../StructuralVariantChordRenderer/types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { CircularViewModel } from '@jbrowse/plugin-circular-view'

interface DisplayModel {
  id: string
  filled: boolean
  error: unknown
  features: Map<string, Feature> | undefined
  cachedSlices: Block[] | undefined
  selectedFeatureId: string | undefined
  configuration: { renderer: AnyConfigurationModel }
  bezierRadiusRatio: number
  onChordClick: (...args: unknown[]) => void
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
  if (!display.filled || !display.features || !display.cachedSlices) {
    return <Loading radius={radius} />
  }

  return (
    <SVChordsReactComponent
      features={display.features}
      blockDefinitions={display.cachedSlices}
      radius={radius}
      bezierRadius={radius * display.bezierRadiusRatio}
      config={display.configuration.renderer}
      displayModel={display}
      onChordClick={
        display.onChordClick as (
          feat: Feature,
          reg: unknown,
          end: unknown,
          evt: unknown,
        ) => void
      }
    />
  )
})

export default ChordVariantDisplay
