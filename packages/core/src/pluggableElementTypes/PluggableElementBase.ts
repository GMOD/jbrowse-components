export default abstract class PluggableElementBase {
  name = ''

  constructor(args: { name: string }) {
    this.name = args.name
  }
}
