export default class PluggableElementType {
  constructor(stuff, ...defaults) {
    Object.assign(this, ...defaults, stuff)
    Object.freeze(this)

    if (!this.name) throw new Error('no "name" defined for pluggable element')
  }
}
