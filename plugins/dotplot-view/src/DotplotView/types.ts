import type { DotplotViewStateModel } from './model.ts'
import type { ViewInit } from '@jbrowse/core/util/withLaunchInput'
import type { SyntenyViewSharedCommands } from '@jbrowse/synteny-core'

// A plot-area pointer position in component px, as the drag handlers and the
// coord-to-bp model actions pass it around.
export type Coord = [number, number]

export const LS_CURSOR_MODE = 'dotplot-cursorMode'

// Below this a drag is a click, not a selection. Shared by the interaction hook
// (which decides whether to open the selection menu) and the model's getCoords
// (which the menu's actions run through), so the two can't disagree about what
// counts as a selection.
export const DRAG_THRESHOLD_PX = 3

// Extra px of reach the hover pick gets beyond half the drawn line width. A
// whole-genome plot is mostly sub-pixel alignments drawn as dots a couple of px
// across, which at the default lineWidth would need the cursor within ~1px to
// hit — unhoverable in practice. Unrelated to DRAG_THRESHOLD_PX above, which
// measures intent rather than reach.
export const HOVER_SLACK_PX = 3

export type { ImportFormSyntenyTrack } from '@jbrowse/synteny-core'

/**
 * The launch keys `DotplotView` writes code for — things to DO, and the names
 * that mean something here other than what the model's property of the same
 * name means. `dotplotLaunchKeys` registers exactly these, and the Record it
 * takes makes an unregistered one a compile error.
 *
 * A plain display setting does not belong here: declaring it on the model is
 * the whole of making it authorable, and the partition leaves it on the
 * snapshot for MST to restore.
 *
 * #launchKeys DotplotView — the URL parameters page renders this interface, and
 * the one it extends, as the view's launch-key table. The `//` comment above
 * each field is what that table shows, so a field added without one fails the
 * docs build rather than rendering a blank cell.
 */
export interface DotplotViewCommands extends SyntenyViewSharedCommands {
  // the two axes, horizontal first. Optional because hand-authored JSON is what
  // fills this and a spec naming only a track partitions into a launch blob
  // with no axes at all; `applyInit` reads that as the import form.
  views?: {
    assembly: string
    // optional per-axis region to navigate to ("ctgA:5000-15000"); hview is
    // views[0], vview is views[1]. Omitted => whole-genome overview.
    loc?: string
    // optional per-axis subset of the assembly's regions, in the given order —
    // the axis shows only these instead of the whole assembly. `loc` navigates
    // WITHIN what an axis displays; this changes what it displays at all, which
    // is what a fragmented assembly needs (e.g. plotting one haplotype of a
    // haplotype-resolved assembly against the reference, instead of both
    // interleaved on one axis). Entries may be globs — `['*_hap1']` beats
    // hand-listing 16 scaffolds and survives the assembly being rebuilt. Same
    // field and same matching as LinearGenomeView's init.displayedRegionNames
    // (both go through selectNamedRegions). Applied before autoDiagonalize, so
    // the reorder runs over the restricted set.
    displayedRegionNames?: string[]
  }[]
  tracks?: string[]
  // loc-strings ("chr1:100-200") or JSON objects matching HighlightType,
  // mirroring LinearGenomeView's init.highlight
  highlight?: string[]
}

/**
 * What a `DotplotView` can be launched with: the commands above, plus ANY
 * declared property of the view — `colorBy`, `alpha`, `drawCigar`, `lineWidth`,
 * `lockAspectRatio`, `lodMode`, `height`, and whatever the model grows next,
 * each in its own type. None of them is listed anywhere: the type comes off the
 * state model, so declaring a property is the whole of making it authorable.
 * Each stays documented once, on the property.
 */
export type DotplotViewInit = ViewInit<
  DotplotViewStateModel,
  DotplotViewCommands
>
