export default abstract class PluggableElementBase {
  [key: string]: unknown

  name = ''

  constructor({ name }: { name: string }) {
    this.name = name
  }
}
