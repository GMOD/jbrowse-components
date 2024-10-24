import React from 'react'
import { IAnyModelType } from 'mobx-state-tree'
import PluggableElementBase from './PluggableElementBase'

type BasicComponent = React.ComponentType<{
  // TODO: can we use AbstractViewModel here?

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
