export default class NestedFrequencyTable {
  constructor(initialData) {
    this.categories = {}
    if (initialData) Object.assign(this.categories, initialData)
  }

  // get the sum of all the category counts
  total() {
    // calculate total if necessary
    let t = 0
    this.categories.forEach(function iterate(item, index) {
      const v = this.categories[index].k
      t += v.total ? v.total() : v
    })
    return t
  }

  // decrement the count for the given category
  decrement(slotName, amount) {
    if (!amount) amount = 1

    if (!slotName) slotName = 'default'
    else slotName = slotName.toString()

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
  increment(slotName, amount) {
    if (!amount) amount = 1

    if (!slotName) slotName = 'default'
    else slotName = slotName.toString()

    this.categories[slotName] = (this.categories[slotName] || 0) + amount
    return this.categories[slotName]
  }

  // get the value of the given category.  may be a number or a
  // frequency table.
  get(slotName) {
    return this.categories[slotName] || 0
  }

  // get a given category as a frequency table
  getNested(path) {
    if (typeof path == 'string') path = path.split('/')

    if (!path.length) return this

    const slotName = path[0].toString()
    let slot = this.categories[slotName]
    if (!slot || !slot.categories)
      this.categories[slotName] = new NestedFrequencyTable(
        slot ? { default: slot + 0 } : {},
      )
    slot = this.categories[slotName]

    if (path.length > 1) {
      return slot.getNested(path.slice(1))
    }
    return slot
  }

  // returns array of category names that are present
  categories() {
    return Object.keys(this.categories)
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
  forEach(func, ctx) {
    if (ctx) {
      this.categories.forEach(function iterate(item, index) {
        func.call(ctx, this.categories[index], this.categories[index].slotName)
      })
    } else {
      this.categories.forEach(function iterate(item, index) {
        func(this.categories[index], this.categories[index].slotName)
      })
    }
  }
}
