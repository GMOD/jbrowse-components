import type { BaseLayout, SerializedLayout } from './BaseLayout.ts'

export default class MultiLayout<SUB_LAYOUT_CLASS extends BaseLayout<T>, T> {
  subLayouts = new Map<string, SUB_LAYOUT_CLASS>()
  SubLayoutClass: new (...args: any[]) => SUB_LAYOUT_CLASS
  subLayoutConstructorArgs: Record<string, unknown>

  /**
   * layout class that just keeps a number of named sub-layouts.
   * basically just a fancier
   * `{ layout1: new GranularRectLayout(), layout2: new GranularRectLayout() ...}`
   */
  constructor(
    SubLayoutClass: new (...args: any[]) => SUB_LAYOUT_CLASS,
    subLayoutConstructorArgs: Record<string, unknown> = {},
  ) {
    this.SubLayoutClass = SubLayoutClass
    this.subLayoutConstructorArgs = subLayoutConstructorArgs
  }

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
    serializableData?: Record<string, T>,
  ) {
    return this.getSublayout(layoutName).addRect(
      id,
      left,
      right,
      height,
      data,
      serializableData,
    )
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
