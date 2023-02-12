export default abstract class PluggableElementBase {
  name: string
  maybeDisplayName?: string

  constructor(args: { name?: string; displayName?: string }) {
    this.name = args.name || 'UNKNOWN'
    this.maybeDisplayName = args.displayName
  }

  get displayName() {
    return this.maybeDisplayName || this.name
  }
}
