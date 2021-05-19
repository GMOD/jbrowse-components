/* eslint-disable @typescript-eslint/no-explicit-any */
// see perf results on object.keys vs for-in loop
// https://jsperf.com/object-keys-vs-hasownproperty/55
export default class NestedFrequencyTable {
  public categories: { [key: string]: any }

  constructor(initialData = {}) {
    this.categories = { ...initialData }
  }

  // get the sum of all the category counts
  total() {
    // calculate total if necessary
    let t = 0

    for (const k in this.categories) {
      const v = this.categories[k]
      t += v.total ? v.total() : v
    }

    return t
  }

  // decrement the count for the given category
  decrement(slotName: string, amount: number) {
    if (!amount) {
      amount = 1
    }

    if (!slotName) {
      slotName = 'default'
    } else {
      slotName = slotName.toString()
    }

    if (this.categories[slotName]) {
      this.categories[slotName] = Math.max(
        0,
        this.categories[slotName] - amount,
      )
      return this.categories[slotName]
    }
    return 0
  }

  // increment the count for the given category
  increment(slotName: string, amount: number) {
    if (!amount) {
      amount = 1
    }

    if (!slotName) {
      slotName = 'default'
    } else {
      slotName = slotName.toString()
    }

    this.categories[slotName] = (this.categories[slotName] || 0) + amount
    return this.categories[slotName]
  }

  // get the value of the given category.  may be a number or a
  // frequency table.
  get(slotName: string) {
    return this.categories[slotName] || 0
  }

  // get a given category as a frequency table
  getNested(path: string | string[]) {
    if (typeof path === 'string') {
      path = path.split('/')
    }

    if (!path.length) {
      return this
    }

    const slotName = path[0].toString()
    let slot = this.categories[slotName]
    if (!slot || !slot.categories) {
      this.categories[slotName] = new NestedFrequencyTable(
        slot ? { default: slot + 0 } : {},
      )
    }
    slot = this.categories[slotName]

    if (path.length > 1) {
      return slot.getNested(path.slice(1))
    }
    return slot
  }

  toString() {
    return this.total()
      .toPrecision(6)
      .toString()
      .replace(/\.?0+$/, '')
  }

  valueOf() {
    return this.total()
  }

  // iterate through the categories and counts, call like:
  //
  //   tbl.forEach( function( count, categoryName ) {
  //      // do something
  //   }, this );
  //
  forEach(func: Function, ctx: any) {
    if (ctx) {
      for (const slotName in this.categories) {
        func.call(ctx, this.categories[slotName], slotName)
      }
    } else {
      for (const slotName in this.categories) {
        func(this.categories[slotName], slotName)
      }
    }
  }
}
