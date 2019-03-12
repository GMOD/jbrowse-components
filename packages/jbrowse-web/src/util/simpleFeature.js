/**
 * Simple implementation of a feature object.
 */
export default class SimpleFeature {
  /**
   * @param args.data {Object} key-value data, must include 'start' and 'end'
   * @param args.parent {Feature} optional parent feature
   * @param args.id {String} unique identifier.  can also be in data.uniqueID.
   * @param args.data.uniqueId {String} alternate location of the unique identifier
   *
   * Note: args.data.subfeatures can be an array of these same args,
   * which will be inflated to more instances of this class.
   */
  constructor(args = {}) {
    this.data = args.data || args
    this.parent = args.parent
    this.uniqueId = args.id || this.data.uniqueId
    if (this.uniqueId === undefined || this.uniqueId === null) {
      throw new Error(
        'SimpleFeature requires a unique `id` or `data.uniqueId` attribute',
      )
    }
    this.uniqueId = String(this.uniqueId)

    if (!(this.data.aliases || this.data.end - this.data.start >= 0)) {
      throw new Error(`invalid feature data`)
    }

    // inflate any subfeatures that are not already feature objects
    const { subfeatures } = this.data
    if (subfeatures) {
      for (let i = 0; i < subfeatures.length; i += 1) {
        if (typeof subfeatures[i].get !== 'function') {
          subfeatures[i] = new SimpleFeature({
            data: subfeatures[i],
            parent: this,
          })
        }
      }
    }
  }

  /**
   * Get a piece of data about the feature.  All features must have
   * 'start' and 'end', but everything else is optional.
   */
  get(name) {
    return this.data[name]
  }

  /**
   * Set an item of data.
   */
  set(name, val) {
    this.data[name] = val
  }

  /**
   * Get an array listing which data keys are present in this feature.
   */
  tags() {
    return Object.keys(this.data)
  }

  /**
   * Get the unique ID of this feature.
   */
  id() {
    return this.uniqueId
  }

  /**
   * Get this feature's parent feature, or undefined if none.
   */
  parent() {
    return this.parent
  }

  /**
   * Get an array of child features, or undefined if none.
   */
  children() {
    return this.get('subfeatures')
  }

  toJSON() {
    const d = { ...this.data, uniqueId: this.id() }
    if (d.parent) d.parentId = d.parent.id()
    delete d.parent
    return d
  }

  static fromJSON(json) {
    return new SimpleFeature({ ...json })
  }
}
