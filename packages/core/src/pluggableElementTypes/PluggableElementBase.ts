export default abstract class PluggableElementBase {
  name: string
  maybeDisplayName?: string

  /**
   * Older names for this element that should be remapped to it when a session
   * or config names one. Each entry is a legacy `type` value previously used.
   *
   * Lets an element own its renames instead of a central migration file, so a
   * plugin can be renamed out of tree. A display declares its renames as
   * `retiredTypes`, which also say what the old type's entries become, and
   * answers these from them.
   */
  aliases?: string[]

  constructor(args?: {
    name?: string
    displayName?: string
    aliases?: string[]
  }) {
    this.name = args?.name || 'UNKNOWN'
    this.maybeDisplayName = args?.displayName
    this.aliases = args?.aliases
  }

  get displayName() {
    return this.maybeDisplayName || this.name
  }
}
