import type { ConfigModelForFields } from '@jbrowse/core/configuration'

/**
 * The config slot a display owes `RowHeightMixin`, so composing the mixin and
 * shipping no slot for it — which compiles, and then throws on the first read —
 * is unspellable.
 *
 * The **type and the default are the contract**, not a style: `0` is the
 * fit-to-display-height sentinel the whole convention turns on
 * (agent-docs/reference/ROW_HEIGHT_AND_FIT.md), and fit is the default
 * everywhere so a cohort with more rows than the track has pixels stays bounded
 * by the track height. Three displays wrote that `number` / `0` pair out by
 * hand, and two of the three descriptions had already drifted apart by a word.
 *
 * The description is the parameter because it is the part that genuinely
 * differs: rows the user can scroll to (maf, the multi-sample variant displays)
 * versus a painting that grows to its content and has nowhere to scroll (the
 * multi-row feature display).
 *
 * **Write it as the whole explanation.** A slot reached by spreading a table
 * renders on its config page from this `description` alone: this file declares
 * no config schema, so the config docs generator has nothing to file a JSDoc
 * comment under and the slot prose below reaches the source and not the page.
 * Everything a config author needs has to be in the sentence.
 */
export function rowHeightConfigSchemaFields({
  rowHeight = 'per-row height in px, scrolling the rows that do not fit; 0 (the default) fits the rows to the display height instead, dividing it between them',
}: {
  /** Overridable, but the default sentence fits any scrolling row display. */
  rowHeight?: string
} = {}) {
  return {
    /**
     * #slot
     * Per-row height in px, or `0` for fit-to-display-height mode where the
     * rows divide the available height between them. The resolved value every
     * consumer reads is the model's `effectiveRowHeight` getter, never this.
     */
    rowHeight: {
      type: 'number',
      defaultValue: 0,
      description: rowHeight,
    },
  } as const
}

/**
 * What `RowHeightMixin` asks a composing display's `configuration` to be — the
 * one slot above and nothing else, since that is the only slot the mixin
 * touches. **Narrow on purpose.** `getConf`/`setConf` check a slot name against
 * the schema of the model they are handed, so a mixin reaching its host through
 * the widened `AnyConfigurationModel` gets no check at all and every name
 * typechecks. What that costs is not symmetric, and the read is the bad half:
 * `setSlot` throws on an unknown name (ADR-052), so a misspelled write is a
 * first-click crash, while a misspelled read just returns `undefined` and has no
 * runtime diagnostic anywhere. Deriving the type from the fields keeps the two
 * in step — rename the slot and every accessor over it stops compiling.
 */
export type RowHeightConfigModel = ConfigModelForFields<
  ReturnType<typeof rowHeightConfigSchemaFields>
>
