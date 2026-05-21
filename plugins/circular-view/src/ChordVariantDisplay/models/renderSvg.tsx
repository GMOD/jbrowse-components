import type { MouseEvent } from 'react'

import { getContainingView } from '@jbrowse/core/util'

import SVChordsReactComponent from '../../ChordRenderer/ReactComponent.tsx'

import type { AnyRegion, Block } from '../../ChordRenderer/types.ts'
import type { CircularViewModel } from '../../CircularView/model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

type RenderSvgModel = IAnyStateTreeNode & {
  features: Map<string, Feature> | undefined
  blockDefinitions: Block[]
  bezierRadiusRatio: number
  // MST's index signature hides subfields, so configuration is typed as unknown
  configuration: unknown
  id: string
  selectedFeatureId: string | undefined
  onChordClick: (
    feature: Feature,
    reg: AnyRegion,
    endBlock: AnyRegion,
    evt: MouseEvent<SVGPathElement>,
  ) => void
}

export function renderSvg(self: RenderSvgModel) {
  const view = getContainingView(self) as CircularViewModel
  const radius = view.radiusPx
  return self.features ? (
    <SVChordsReactComponent
      features={self.features}
      blockDefinitions={self.blockDefinitions}
      radius={radius}
      bezierRadius={radius * self.bezierRadiusRatio}
      config={
        (self.configuration as { renderer: AnyConfigurationModel }).renderer
      }
      displayModel={self}
      onChordClick={self.onChordClick}
    />
  ) : null
}
