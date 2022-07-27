import React from 'react'
import { IAnyModelType } from 'mobx-state-tree'
import PluggableElementBase from './PluggableElementBase'

type BasicComponent = React.ComponentType<{
  // TODO: can we use AbstractViewModel here?
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any
}>
type AddTrackWorkflowComponent =
  | React.LazyExoticComponent<BasicComponent>
  | BasicComponent

export default class AddTrackWorkflow extends PluggableElementBase {
  ReactComponent: AddTrackWorkflowComponent

  stateModel: IAnyModelType

  constructor(stuff: {
    name: string
    ReactComponent: AddTrackWorkflowComponent
    stateModel: IAnyModelType
  }) {
    super(stuff)
    this.ReactComponent = stuff.ReactComponent
    this.stateModel = stuff.stateModel
    if (!this.ReactComponent) {
      throw new Error(`no ReactComponent defined for view ${this.name}`)
    }
    if (!this.stateModel) {
      throw new Error(`no stateModel defined for view ${this.name}`)
    }
  }
}
