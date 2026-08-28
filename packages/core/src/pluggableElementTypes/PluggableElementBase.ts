export default abstract class PluggableElementBase {
  name: string
  maybeDisplayName?: string

  /**
   * Older names for this element that should be remapped to it when a session
   * or config names one. Each entry is a legacy `type` value previously used.
   *
   * Lets an element own its renames instead of a central migration file, so a
   * plugin can be renamed out of tree. A per-element `preProcessSnapshot` hook
   * then handles any property migrations within the renamed type; for a
   * migration that rewrites the value of an existing constrained slot (an enum
   * rename, a type narrow) use `addDisplayConfigMigration` instead — see that
   * helper for why.
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
