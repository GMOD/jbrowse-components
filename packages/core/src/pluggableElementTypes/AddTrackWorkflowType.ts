import type React from 'react'

import PluggableElementBase from './PluggableElementBase.ts'

import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

type BasicComponent = React.ComponentType<{
  model: any
}>
type AddTrackWorkflowComponentType =
  React.LazyExoticComponent<BasicComponent> | BasicComponent

// 'general' workflows accept any track (file/URL, JSON, bulk); 'specialized'
// ones target a particular data type (GWAS, MAF, multi-wiggle). Used to group
// the Add Track dropdown under subheaders.
export type AddTrackWorkflowCategory = 'general' | 'specialized'

export default class AddTrackWorkflow extends PluggableElementBase {
  ReactComponent: AddTrackWorkflowComponentType

  category: AddTrackWorkflowCategory

  stateModel: IAnyModelType

  constructor(stuff: {
    name: string
    displayName?: string
    category?: AddTrackWorkflowCategory
    ReactComponent: AddTrackWorkflowComponentType
    stateModel: IAnyModelType
  }) {
    super(stuff)
    this.ReactComponent = stuff.ReactComponent
    this.category = stuff.category ?? 'specialized'
    this.stateModel = stuff.stateModel
  }
}
