import PluggableElementType from './PluggableElementBase'

export default class ViewType extends PluggableElementType {
  constructor(stuff) {
    super(stuff)
    if (!this.ReactComponent) {
      throw new Error(`no ReactComponent defined for view ${this.name}`)
    }
    if (!this.stateModel) {
      throw new Error(`no stateModel defined for view ${this.name}`)
    }
  }
}
