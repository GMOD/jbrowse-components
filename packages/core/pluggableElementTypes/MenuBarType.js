import PluggableElementType from './PluggableElementBase'

export default class MenuBarType extends PluggableElementType {
  constructor(stuff) {
    super(stuff)
    if (!this.LazyReactComponent) {
      throw new Error(`no LazyReactComponent defined for menu bar ${this.name}`)
    }
    if (!this.stateModel) {
      throw new Error(`no stateModel defined for menu bar ${this.name}`)
    }
  }
}
