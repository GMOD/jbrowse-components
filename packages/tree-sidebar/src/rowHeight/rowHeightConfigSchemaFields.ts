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
 */
export function rowHeightConfigSchemaFields({
  rowHeight = 'per-row height in px, scrolling the rows that do not fit; 0 fits the rows to the display height instead',
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
