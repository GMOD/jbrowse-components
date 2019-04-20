import PluggableElementType from './PluggableElementBase'

export default class DrawerWidgetType extends PluggableElementType {
  constructor(stuff) {
    super(stuff)
    if (!this.LazyReactComponent) {
      throw new Error(
        `no LazyReactComponent defined for drawer widget ${this.name}`,
      )
    }
    if (!this.stateModel) { throw new Error(`no stateModel defined for drawer widget ${this.name}`) }
  }
}
