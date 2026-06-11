import { getContainingView } from '@jbrowse/core/util'
import { when } from 'mobx'

import SVChordsReactComponent from '../../ChordRenderer/ReactComponent.tsx'
import DisplayError from '../components/DisplayError.tsx'

import type { Block } from '../../ChordRenderer/types.ts'
import type { CircularViewModel } from '../../CircularView/model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

type RenderSvgModel = IAnyStateTreeNode & {
  ready: boolean
  error: unknown
  features: Feature[] | undefined
  blocksForRefs: Record<string, Block>
  bezierRadiusRatio: number
  configuration: AnyConfigurationModel
  id: string
  selectedFeatureId: string | undefined
  onChordClick: (feature: Feature) => void
}

export async function renderSvg(self: RenderSvgModel) {
  await when(() => self.ready || self.error !== undefined)
  const view = getContainingView(self) as CircularViewModel
  const radius = view.radiusPx
  return self.error ? (
    <DisplayError model={self} radius={radius} />
  ) : self.features ? (
    <SVChordsReactComponent
      features={self.features}
      blocksForRefs={self.blocksForRefs}
      radius={radius}
      bezierRadius={radius * self.bezierRadiusRatio}
      config={self.configuration}
      displayModel={self}
      onChordClick={self.onChordClick}
    />
  ) : null
}
