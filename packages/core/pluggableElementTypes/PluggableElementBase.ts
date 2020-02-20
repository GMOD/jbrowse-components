export default class PluggableElementBase {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [memberName: string]: any

  name = ''

  constructor({ name }: { name: string }) {
    this.name = name
    if (!this.name) throw new Error('no "name" defined for pluggable element')
  }
}
