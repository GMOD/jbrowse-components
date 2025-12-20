import type React from 'react'

import PluggableElementBase from './PluggableElementBase'

import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

type BasicComponent = React.ComponentType<{
  model: any
}>
type AddTrackWorkflowComponentType =
  | React.LazyExoticComponent<BasicComponent>
  | BasicComponent

export default class AddTrackWorkflow extends PluggableElementBase {
  ReactComponent: AddTrackWorkflowComponentType

  stateModel: IAnyModelType

  constructor(stuff: {
    name: string
    ReactComponent: AddTrackWorkflowComponentType
    stateModel: IAnyModelType
  }) {
    super(stuff)
    this.ReactComponent = stuff.ReactComponent
    this.stateModel = stuff.stateModel
  }
}
