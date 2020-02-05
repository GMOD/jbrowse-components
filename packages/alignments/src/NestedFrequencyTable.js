/* eslint-disable guard-for-in */
export default class NestedFrequencyTable {
  constructor(initialData) {
    this.categories = {}
    if (initialData) Object.assign(this.categories, initialData)
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

  generateInfoList() {
    const infoList = []
    const overallScore = this.total()

    // log info w/ base name, total score, and strand breakdown
    for (const key of Object.keys(this.categories)) {
      const v = this.categories[key].categories
      const scoreInBase = Object.values(v).reduce((a, b) => a + b, 0)
      infoList.push({
        base: key,
        score: scoreInBase,
        strands: v,
      })
    }

    // sort so higher scores get drawn last, reference always first
    infoList.sort((a, b) =>
      a.score < b.score || b.base === 'reference' ? 1 : -1,
    )

    // add overall total to end
    infoList.push({
      base: 'total',
      score: overallScore,
    })
    return infoList
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
