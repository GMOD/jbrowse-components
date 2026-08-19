import type { ConfigModelForFields } from '@jbrowse/core/configuration'

/**
 * The config slots a display owes `TreeSidebarMixin` — one object, so a display
 * composing the mixin cannot ship two of the three.
 *
 * All three are read by code in *this* package rather than by the display:
 * `showTree` gates `TreeSidebar`, `SvgTreeSidebar` and `treeSidebarOffset`,
 * `showBranchLength` reaches `computeClusterHierarchy` and
 * `treeBranchLengthMenuItem`, `showRowLabels` is `RowLabelsOverlay`'s
 * `showLabels`. Four displays declared them by hand and the set had already
 * drifted: three spelled the labels toggle `showRowLabels` and the fourth
 * spelled it `showSidebarLabels`, so `"showRowLabels": false` on a
 * multi-sample variant track was dropped in silence.
 *
 * The **descriptions** are the parameter because they are the part that is
 * genuinely per display — a MAF row is a species, a multi-wiggle row a subtrack,
 * a variant row a sample — while the types and defaults are not, and every
 * display had written the same three `boolean`/`true` triples.
 */
export function treeSidebarConfigSchemaFields({
  tree,
  rowLabels,
  branchLength = 'position tree nodes by branch length (dendrogram) rather than evenly by topology (cladogram)',
}: {
  /** e.g. "show the species tree sidebar" */
  tree: string
  /** e.g. "draw the species name over the left of each row" */
  rowLabels: string
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
  } as const
}

/**
 * What `TreeSidebarMixin` asks a composing display's `configuration` to be — the
 * three slots above and nothing else, which is all the mixin touches. Narrow so
 * `getConf`/`setConf` still check the slot name; see `ConfigModelForFields`.
 */
export type TreeSidebarConfigModel = ConfigModelForFields<
  ReturnType<typeof treeSidebarConfigSchemaFields>
>
