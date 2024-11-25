import type { BaseLayout, SerializedLayout } from './BaseLayout'

export default class MultiLayout<SUB_LAYOUT_CLASS extends BaseLayout<T>, T> {
  subLayouts = new Map<string, SUB_LAYOUT_CLASS>()

  /**
   * layout class that just keeps a number of named sub-layouts.
   * basically just a fancier
   * `{ layout1: new GranularRectLayout(), layout2: new GranularRectLayout() ...}`
   */
  constructor(
    public SubLayoutClass: new (...args: any[]) => SUB_LAYOUT_CLASS,
    public subLayoutConstructorArgs: Record<string, any> = {},
  ) {}

  getDataByID(id: string): unknown {
    for (const layout of this.subLayouts.values()) {
      // @ts-expect-error
      const r = layout.getDataByID(id)
      if (r) {
        return r
      }
    }
    return undefined
  }

  getSublayout(layoutName: string): SUB_LAYOUT_CLASS {
    let subLayout = this.subLayouts.get(layoutName)
    if (subLayout === undefined) {
      subLayout = new this.SubLayoutClass(this.subLayoutConstructorArgs)
      this.subLayouts.set(layoutName, subLayout)
      return subLayout
    }

    return subLayout
  }

  addRect(
    layoutName: string,
    id: string,
    left: number,
    right: number,
    height: number,
    data: Record<string, T> = {},
  ) {
    return this.getSublayout(layoutName).addRect(id, left, right, height, data)
  }

  discardRange(layoutName: string, left: number, right: number) {
    return this.subLayouts.get(layoutName)?.discardRange(left, right)
  }

  toJSON() {
    const data: Record<string, SerializedLayout> = {}
    for (const [layoutName, sublayout] of this.subLayouts.entries()) {
      data[layoutName] = sublayout.toJSON()
    }
    return data
  }
}
