import type { ConfigModelForFields } from '@jbrowse/core/configuration'

/**
 * The config slot a display owes `TrackHeightMixin` — the height its `height`
 * getter reads and every drag-resize writes back.
 *
 * A table beside the mixin, the way `regionTooLargeConfigSchemaFields` and
 * `rowHeightConfigSchemaFields` are: most displays inherit the slot from
 * `baseLinearDisplayConfigSchema`, and the ones composing the mixin against a
 * schema that does not extend it wrote the same three lines out by hand. Six
 * copies, and the wording had already split two ways ("Default height of the
 * track" against "default height for the track") over the same slot.
 *
 * The default height is the parameter because it is what genuinely differs: a
 * Hi-C contact triangle opens at 300px, a multi-source wiggle at 200, a
 * Manhattan plot at 100. The type is not, and a `maybeNumber` height is a
 * different contract — a display with an auto-fit mode declares its own.
 *
 * **Write the description as the whole explanation.** A slot reached by
 * spreading a table renders on its config page from `description` alone; this
 * file declares no config schema, so a JSDoc here reaches the source and not
 * the page.
 */
export function trackHeightConfigSchemaFields({
  defaultHeight = 100,
  height = 'default height for the track',
}: {
  defaultHeight?: number
  /** Overridable, but the default sentence fits any fixed-height display. */
  height?: string
} = {}) {
  return {
    /**
     * #slot
     */
    height: {
      type: 'number',
      defaultValue: defaultHeight,
      description: height,
    },
  } as const
}

/**
 * What `TrackHeightMixin` asks a composing display's `configuration` to be.
 * Exactly the slot above — it used to be the whole of
 * `BaseLinearDisplayConfigModel`, which both overstated what the mixin needs
 * and admitted every other base slot name to its `getConf`/`setConf` calls.
 */
export type TrackHeightConfigModel = ConfigModelForFields<
  ReturnType<typeof trackHeightConfigSchemaFields>
>
