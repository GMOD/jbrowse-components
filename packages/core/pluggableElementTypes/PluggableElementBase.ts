export default abstract class PluggableElementBase {
  [key: string]: unknown

  name = ''

  constructor({ name }: { name: string }) {
    this.name = name
    if (!this.name) throw new Error('no "name" defined for pluggable element')
  }
}
