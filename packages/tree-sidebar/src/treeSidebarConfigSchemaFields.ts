import type { ConfigModelForFields } from '@jbrowse/core/configuration'

/**
 * The config slots a display owes `TreeSidebarMixin` — one object, so a display
 * composing the mixin cannot ship three of the four.
 *
 * The three toggles are read by code in *this* package rather than by the
 * display: `showTree` gates `TreeSidebar`, `SvgTreeSidebar` and
 * `treeSidebarOffset`, `showBranchLength` reaches `computeClusterHierarchy` and
 * `treeBranchLengthMenuItem`, `showRowLabels` is `RowLabelsOverlay`'s
 * `showLabels`. Four displays declared them by hand and the set had already
 * drifted: three spelled the labels toggle `showRowLabels` and the fourth
 * spelled it `showSidebarLabels`, so `"showRowLabels": false` on a
 * multi-sample variant track was dropped in silence.
 *
 * `domain` is the fourth, and the row axis's declared order: the config seed
 * under `layout`, which stays the runtime arrangement every drag, dialog,
 * clustering run and column sort writes. The multi-row feature display had the
 * only one; the other three had no declared order at all, so a config or a
 * session spec pinning rows had to write the whole `layout` row table.
 *
 * The **descriptions** are the parameter because they are the part that is
 * genuinely per display — a MAF row is a species, a multi-wiggle row a subtrack,
 * a variant row a sample — while the types and defaults are not, and every
 * display had written the same three `boolean`/`true` triples.
 */
export function treeSidebarConfigSchemaFields({
  tree,
  rowLabels,
  rows,
  branchLength = 'position tree nodes by branch length (dendrogram) rather than evenly by topology (cladogram)',
}: {
  /** e.g. "show the species tree sidebar" */
  tree: string
  /** e.g. "draw the species name over the left of each row" */
  rowLabels: string
  /**
   * The `domain` sentence, which has to name what a row is and what the rows
   * it does not list fall back on — a tree's leaf order, an adapter's, a
   * file's. e.g. "row order: the species listed come first, in this order, and
   * the rest keep the tree's order"
   */
  rows: string
  /** Overridable, but the default sentence is display-independent. */
  branchLength?: string
}) {
  return {
    /**
     * #slot
     */
    showTree: {
      type: 'boolean',
      defaultValue: true,
      description: tree,
    },
    /**
     * #slot
     */
    showBranchLength: {
      type: 'boolean',
      defaultValue: true,
      description: branchLength,
    },
    /**
     * #slot
     * Drawn as an overlay on the plot rather than in a gutter beside it, and
     * each label is as wide as its own text — so on a wide view the left of
     * every row sits under its own name. That is what this exists to turn off.
     */
    showRowLabels: {
      type: 'boolean',
      defaultValue: true,
      description: rowLabels,
    },
    /**
     * #slot
     * The row axis's declared order, read through the mixin's `rowDomain`
     * getter and applied under `layout`: a row the list names is placed, a row
     * it does not keeps the order it arrived in. Empty — the default — is
     * today's order untouched.
     *
     * **Where the rows are a tree's leaves it is a preference, not a
     * placement.** A phylogeny fixes its leaf order only up to a rotation at
     * each node, so the tree turns towards the list as far as its topology
     * allows and keeps drawing (`rotateNewickByDomain`): `['B','C','D']` on
     * `((A,B),(C,D))` gives `B,A,C,D`, because A rides with B. A supplied tree
     * rotates where it is parsed and a clustering run rotates its own, so the
     * tree and the row order always move together.
     */
    domain: {
      type: 'stringArray',
      defaultValue: [],
      description: rows,
    },
    /**
     * #slot
     * Width in px of the sidebar the dendrogram draws in, left of the row
     * labels. A drag on its edge writes this, the way a drag on the track's
     * bottom edge writes `height`.
     */
    treeAreaWidth: {
      type: 'number',
      defaultValue: 80,
      description:
        'width in px of the tree sidebar, which a drag on its edge also writes',
    },
  } as const
}

/**
 * The row-separators slot, for the three row displays that draw them — spread
 * beside {@link treeSidebarConfigSchemaFields} rather than folded into it,
 * because MAF composes the sidebar and deliberately draws no separators (its
 * rows already carry a `rowProportion` gap), and a slot it ignores would read
 * as one it honors.
 *
 * The three that do draw them had written the triple out identically bar the
 * row noun, and the prose had drifted three ways: one display explained why the
 * default is off, one restated the height rule in half a sentence, and one said
 * nothing at all.
 *
 * **The description is the whole explanation**, for the reason
 * `rowHeightConfigSchemaFields` states: a slot reached by spreading a table
 * renders on its config page from this string alone, since this file declares
 * no config schema for a JSDoc body to be filed under. It is a parameter only
 * so a display whose rows are something more specific than "rows" can say so.
 *
 * The getter and setter over this stay per display, unlike the sidebar's three:
 * `TreeSidebarMixin` declares those because this package's own code reads them,
 * and nothing here reads this one — `showRowSeparatorsMenuItem` is handed the
 * value. Declaring them in the mixin would mean MAF holding a `getConf` for a
 * slot it does not have.
 */
export function rowSeparatorsConfigSchemaFields({
  rowSeparators = 'draw a hairline between adjacent rows; off by default, because a painting whose neighbouring rows differ in color already separates itself and the line only earns its pixel where they do not — a run of same-colored rows reads as one block without it, with no way to recover the row count by eye. Drawn only once rows are at least 4px tall: below that the line is as thick as the row it borders, turning a dense painting into a grid of hairlines with a little color between them',
}: {
  /** Overridable, but the default sentence fits any row display. */
  rowSeparators?: string
} = {}) {
  return {
    /**
     * #slot
     */
    showRowSeparators: {
      type: 'boolean',
      defaultValue: false,
      description: rowSeparators,
    },
  } as const
}

/**
 * What `TreeSidebarMixin` asks a composing display's `configuration` to be — the
 * four slots above and nothing else, which is all the mixin touches. Narrow so
 * `getConf`/`setConf` still check the slot name; see `ConfigModelForFields`.
 */
export type TreeSidebarConfigModel = ConfigModelForFields<
  ReturnType<typeof treeSidebarConfigSchemaFields>
>
