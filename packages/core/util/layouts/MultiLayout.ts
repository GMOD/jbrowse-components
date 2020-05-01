/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseLayout, SerializedLayout } from './BaseLayout'

export default class MultiLayout<SUB_LAYOUT_CLASS extends BaseLayout<T>, T> {
  subLayouts: Map<string, SUB_LAYOUT_CLASS> = new Map()

  SubLayoutClass: new (...args: any[]) => SUB_LAYOUT_CLASS

  subLayoutConstructorArgs: Record<string, any> = {}

  /**
   * layout class that just keeps a number of named sub-layouts.
   * basically just a fancier
   * `{ layout1: new GranularRectLayout(), layout2: new GranularRectLayout() ...}`
   */
  constructor(
    SubLayoutClass: new (...args: any[]) => SUB_LAYOUT_CLASS,
    layoutArgs: Record<string, any> = {},
  ) {
    this.subLayouts = new Map()
    this.SubLayoutClass = SubLayoutClass
    this.subLayoutConstructorArgs = layoutArgs
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
    const layout = this.subLayouts.get(layoutName)
    return layout && layout.discardRange(left, right)
  }

  toJSON() {
    const data: Record<string, SerializedLayout> = {}
    for (const [layoutName, sublayout] of this.subLayouts.entries()) {
      data[layoutName] = sublayout.toJSON()
    }
    return data
  }
}
