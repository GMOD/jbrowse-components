import type { ConfigModelForFields } from '@jbrowse/core/configuration'

/**
 * The config slot a display owes `BaseChordDisplay`, spread by both chord
 * schemas so composing the base and shipping no slot for it is unspellable.
 *
 * A const rather than a factory, since no display varies the prose: the docs
 * generator resolves a spread table by name either way, but it reads a factory
 * only through its destructured parameter, which a table with nothing to
 * substitute does not have.
 *
 * Write the description as the whole explanation: a slot reached by spreading
 * a table renders on its config page from this sentence alone, since this file
 * declares no config schema for the docs generator to file a JSDoc under.
 */
export const chordConfigSchemaFields = {
  bezierRadiusRatio: {
    type: 'number',
    defaultValue: 0.1,
    description:
      "how far from the center a chord across the circle passes, as a fraction of the circle's radius: 0 draws it straight through the center, and a larger value keeps every chord nearer the rim. A shorter chord bows less, in proportion to its span",
  },
} as const

export type ChordConfigModel = ConfigModelForFields<
  typeof chordConfigSchemaFields
>
