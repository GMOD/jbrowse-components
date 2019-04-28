import MultiLayout from './MultiLayout'
import PrecomputedLayout from './PrecomputedLayout'

class ThrowingLayout {
  constructor() {
    throw new Error('invalid layout name')
  }
}

export default class PrecomputedMultiLayout extends MultiLayout {
  constructor(json) {
    // use ThrowingLayout because there is not supposed to be any creation
    // of new layouts in a precomputed layout
    super(ThrowingLayout)
    Object.entries(json).forEach(([layoutName, sublayoutJson]) => {
      this.subLayouts.set(layoutName, new PrecomputedLayout(sublayoutJson))
    })
  }
}
