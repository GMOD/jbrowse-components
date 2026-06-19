import { lazy } from 'react'

import { getContainingView, getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import DisplayError from './DisplayError.tsx'
import Loading from './Loading.tsx'
import SVChordsReactComponent from '../../ChordRenderer/ReactComponent.tsx'

const ErrorMessageStackTraceDialog = lazy(
  () => import('@jbrowse/core/ui/ErrorMessageStackTraceDialog'),
)

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
  configuration: AnyConfigurationModel
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
    return (
      <DisplayError
        model={display}
        radius={radius}
        onClick={() => {
          getSession(view).queueDialog(onClose => [
            ErrorMessageStackTraceDialog,
            { onClose, error: display.error },
          ])
        }}
      />
    )
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
      config={display.configuration}
      displayModel={display}
      onChordClick={display.onChordClick}
    />
  )
})

export default ChordVariantDisplay
