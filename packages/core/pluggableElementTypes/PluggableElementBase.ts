export default abstract class PluggableElementBase {
  name = ''
  maybeDisplayName?: string

  constructor(args: { name: string; displayName?: string }) {
    this.name = args.name
    this.maybeDisplayName = args.displayName
  }

  get displayName() {
    return this.maybeDisplayName || this.name
  }
}
