export default abstract class PluggableElementBase {
  [key: string]: unknown

  name = ''

  constructor({ name }: { name: string } = { name: '' }) {
    this.name = name || this.constructor.name
  }
}
