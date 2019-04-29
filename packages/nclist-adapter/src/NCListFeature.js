/* eslint-disable @typescript-eslint/camelcase */

const jb2ToJb1 = { refName: 'seq_id' }

const jb1ToJb2 = { seq_id: 'refName' }

/**
 * wrapper to adapt nclist features to act like jbrowse 2 features
 */
export default class NCListFeature {
  constructor(ncFeature, parent) {
    this.ncFeature = ncFeature
    this.uniqueId = ncFeature.id()
    this.parent = parent
  }

  jb2TagToJb1Tag(tag) {
    const mapped = jb2ToJb1[tag] || tag
    return mapped.toLowerCase()
  }

  jb1TagToJb2Tag(tag) {
    const t = tag.toLowerCase()
    const mapped = jb1ToJb2[t] || t
    return mapped
  }

  get(attrName) {
    return this.ncFeature.get(this.jb2TagToJb1Tag(attrName))
  }

  /**
   * Get an array listing which data keys are present in this feature.
   */
  tags() {
    return this.ncFeature.tags().map(t => this.jb1TagToJb2Tag(t))
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
    const data = { uniqueId: this.id() }
    this.ncFeature.tags().forEach(tag => {
      const mappedTag = this.jb1TagToJb2Tag(tag)
      const value = this.ncFeature.get(tag)
      if (mappedTag === 'subfeatures') {
        data.subfeatures = (value || []).map((f, i) =>
          new NCListFeature(f, `${this.id()}-${i}`, this).toJSON(),
        )
      } else {
        data[mappedTag] = value
      }
    })
    return data
  }
}
