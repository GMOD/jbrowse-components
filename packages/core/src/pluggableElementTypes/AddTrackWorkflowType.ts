import PluggableElementBase from './PluggableElementBase.ts'

import type { IAnyModelType } from '@jbrowse/mobx-state-tree'
import type React from 'react'

// The Add Track widget renders workflow components with both `model` and a
// `switchWorkflow` callback (see AddTrackWidget), so both are part of the
// contract. Components that only read `model` stay assignable (extra prop).
type BasicComponent = React.ComponentType<{
  model: any
  switchWorkflow: (name: string) => void
}>
type AddTrackWorkflowComponentType =
  | React.LazyExoticComponent<BasicComponent>
  | BasicComponent

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
