export default class MultiLayout {
  /**
   * layout class that just keeps a number of named sub-layouts.
   * basically just a fancier
   * `{ layout1: new GranularRectLayout(), layout2: new GranularRectLayout() ...}`
   */
  constructor(SubLayoutClass, layoutArgs = {}) {
    this.subLayouts = new Map()
    this.SubLayoutClass = SubLayoutClass
    this.subLayoutConstructorArgs = layoutArgs
  }

  getSublayout(layoutName) {
    let subLayout = this.subLayouts.get(layoutName)
    if (!subLayout) {
      subLayout = new this.SubLayoutClass(this.subLayoutConstructorArgs)
      this.subLayouts.set(layoutName, subLayout)
    }

    return subLayout
  }

  addRect(layoutName, ...args) {
    return this.getSublayout(layoutName).addRect(...args)
  }

  discardRange(layoutName, ...args) {
    return this.getSublayout(layoutName).discardRange(...args)
  }

  toJSON() {
    const data = {}
    for (const [layoutName, sublayout] of this.subLayouts.entries()) {
      data[layoutName] = sublayout.toJSON()
    }
    return data
  }
}
