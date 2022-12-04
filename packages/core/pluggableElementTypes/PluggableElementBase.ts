export default abstract class PluggableElementBase {
  name = ''
  displayName = ''

  constructor(args: { name: string; displayName?: string }) {
    this.name = args.name
    this.displayName = args.displayName || ''
  }
}
