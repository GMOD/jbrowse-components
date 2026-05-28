import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import DisplayError from './DisplayError.tsx'
import Loading from './Loading.tsx'
import SVChordsReactComponent from '../../ChordRenderer/ReactComponent.tsx'

import type { Block } from '../../ChordRenderer/types.ts'
import type { CircularViewModel } from '../../CircularView/model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

interface DisplayModel {
  id: string
  error: unknown
  features: Feature[] | undefined
  blocksForRefs: Record<string, Block>
  selectedFeatureId: string | undefined
  configuration: { renderer: AnyConfigurationModel }
  bezierRadiusRatio: number
  onChordClick: (feature: Feature) => void
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
  if (!display.features) {
    return <Loading radius={radius} />
  }

  return (
    <SVChordsReactComponent
      features={display.features}
      blocksForRefs={display.blocksForRefs}
      radius={radius}
      bezierRadius={radius * display.bezierRadiusRatio}
      config={display.configuration.renderer}
      displayModel={display}
      onChordClick={display.onChordClick}
    />
  )
})

export default ChordVariantDisplay
