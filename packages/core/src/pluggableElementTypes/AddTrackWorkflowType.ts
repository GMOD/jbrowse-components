import PluggableElementBase from './PluggableElementBase.ts'

import type { AddTrackWorkflowModel } from '../util/addTrackFromWidget.ts'
import type { IAnyModelType } from '@jbrowse/mobx-state-tree'
import type React from 'react'

/**
 * What the Add Track widget renders a workflow with. A component reading only
 * `model` stays assignable.
 */
export interface AddTrackWorkflowProps {
  model: AddTrackWorkflowModel
  /** show another workflow, by its registered name */
  switchWorkflow: (name: string) => void
}

type BasicComponent = React.ComponentType<AddTrackWorkflowProps>
export type AddTrackWorkflowComponentType =
  | React.LazyExoticComponent<BasicComponent>
  | BasicComponent

// 'general' workflows accept any track (file/URL, JSON, bulk); 'specialized'
// ones target a particular data type (MAF, multi-row). Used to group
// the Add Track dropdown under subheaders.
export type AddTrackWorkflowCategory = 'general' | 'specialized'

export default class AddTrackWorkflow extends PluggableElementBase {
  ReactComponent: AddTrackWorkflowComponentType

  category: AddTrackWorkflowCategory

  /**
   * @deprecated The widget never instantiated it. A workflow keeps its form on
   * the widget model with `workflowForm` from `@jbrowse/core/util`.
   */
  stateModel?: IAnyModelType

  constructor(stuff: {
    name: string
    displayName?: string
    category?: AddTrackWorkflowCategory
    ReactComponent: AddTrackWorkflowComponentType
    /** @deprecated unused; see the field */
    stateModel?: IAnyModelType
  }) {
    super(stuff)
    this.ReactComponent = stuff.ReactComponent
    this.category = stuff.category ?? 'specialized'
    this.stateModel = stuff.stateModel
  }
}
