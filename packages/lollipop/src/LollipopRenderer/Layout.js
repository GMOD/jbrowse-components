import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { doesIntersect2 } from '@gmod/jbrowse-core/util/range'

export class FloatingLayout {
  constructor({ width }) {
    if (!width) throw new Error('width required to make a new FloatingLayout')
    this.width = width
  }

  items = []

  layout = new Map()

  layoutDirty = false

  add(uniqueId, anchorLocation, width, height, data) {
    this.items.push({ uniqueId, anchorLocation, width, height, data })
    this.layoutDirty = true
  }

  /**
   * @returns {Map} of uniqueId => {x,y,anchorLocation,width,height,data}
   */
  getLayout(configuration) {
    if (!this.layoutDirty) return this.layout
    if (!configuration) throw new Error('configuration object required')

    const minY = readConfObject(configuration, 'minStickLength')

    // sort them by score ascending, so higher scores will always end up
    // stacked last (toward the bottom)
    const sorted = this.items.sort((a, b) => a.data.score - b.data.score)

    // bump them
    let maxBottom = 0
    const layoutEntries = Array(sorted.length)
    for (let i = 0; i < sorted.length; i += 1) {
      const currentItem = sorted[i]
      const { anchorLocation, width, height } = currentItem
      const start = anchorLocation - width / 2
      const end = start + width
      let top = minY
      let bottom = top + height

      // figure out how far down to put it
      for (let j = 0; j < i; j += 1) {
        const [, previouslyLayedOutItem] = layoutEntries[j]
        const {
          x: prevStart,
          y: prevTop,
          width: prevWidth,
          height: prevHeight,
        } = previouslyLayedOutItem
        const prevEnd = prevStart + prevWidth
        const prevBottom = prevTop + prevHeight
        if (
          doesIntersect2(prevStart, prevEnd, start, end) &&
          doesIntersect2(prevTop, prevBottom, top, bottom)
        ) {
          // bump this one to the bottom of the previous one
          top = prevBottom
          bottom = top + height
          j = -1 // we need to check all of them again after bumping
        }
      }

      // record the entry and update the maxBottom
      layoutEntries[i] = [
        currentItem.uniqueId,
        { ...currentItem, x: start, y: top },
      ]
      if (bottom > maxBottom) maxBottom = bottom
    }

    // try to tile them left to right all at the same level
    // if they don't fit, try to alternate them on 2 levels, then 3
    this.totalHeight = maxBottom
    this.layout = new Map(layoutEntries)
    this.layoutDirty = false
    return this.layout
  }

  getTotalHeight() {
    if (this.layoutDirty) this.getLayout()
    return this.totalHeight
  }

  serializeRegion() {
    return this.toJSON()
  }

  toJSON() {
    return { pairs: [...this.getLayout()], totalHeight: this.getTotalHeight() }
  }

  static fromJSON() {
    throw new Error('not supported')
  }
}

export class PrecomputedFloatingLayout {
  constructor({ pairs, totalHeight }) {
    this.layout = new Map(pairs)
    this.totalHeight = totalHeight
  }

  add(uniqueId) {
    if (!this.layout.has(uniqueId))
      throw new Error(`layout error, precomputed layout is missing ${uniqueId}`)
  }

  getLayout() {
    return this.layout
  }

  getTotalHeight() {
    return this.totalHeight
  }

  static fromJSON(json) {
    return new PrecomputedFloatingLayout(json)
  }
}
