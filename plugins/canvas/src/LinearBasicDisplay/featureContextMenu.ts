import { lazy } from 'react'

import { Highlighter } from '@jbrowse/core/ui/Icons'
import { undoItems } from '@jbrowse/core/ui/filterMenuItems'
import { withHint } from '@jbrowse/core/ui/menuItems'
import {
  assembleLocString,
  getDialogHost,
  pluralize,
  withFeatureDetails,
} from '@jbrowse/core/util'
import { copyText } from '@jbrowse/core/util/copyText'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import BiotechIcon from '@mui/icons-material/Biotech'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'
import PlaylistRemoveIcon from '@mui/icons-material/PlaylistRemove'
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'

import { copyItem } from '../shared/copyMenuItem.ts'
import { featureSpanEndBp } from '../shared/featureSpanBp.ts'
import { findSubfeatureById } from './baseModelHelpers.ts'

import type {
  FlatbushItem,
  SubfeatureInfo,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { HighlightTarget } from './featureHighlight.ts'
import type { SequenceHoverPosition } from '@jbrowse/core/BaseFeatureWidget'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Reversibles } from '@jbrowse/core/ui/filterMenuItems'
import type { Feature, Region } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { ElementType } from 'react'

const FeatureSequenceDialog = lazy(
  () => import('./components/FeatureSequenceDialog.tsx'),
)

// Everything a right-click resolved, as one value: the model stores it
// verbatim (see openContextMenu) and this builder reads it back, so a new
// hit-derived field costs one edit here rather than three.
export interface FeatureContextMenuInfo {
  item: FlatbushItem
  // The transcript under the cursor, when the right-click landed on one. Lets
  // the menu act on the specific isoform the user aimed at rather than its
  // whole gene. Absent for gene-level entry points (the label layer) and for
  // featureless glyphs.
  subfeature?: SubfeatureInfo
  // The HGVS position the right-click landed on, resolved at click time (see
  // hgvsHitLabel) because only the hit knows the genomic position and the zoom
  // it was read at. Absent for the label layer, which is a click on a name
  // rather than on a base.
  hgvsLabel?: string
  // Plain-text form of the hover tooltip this hit would show (see
  // hoverTooltipText), resolved at click time for the same reason as
  // hgvsLabel. The label layer passes the feature's own tooltip, which is what
  // its hover shows.
  tooltipText?: string
  displayedRegionIndex: number
  clientX: number
  clientY: number
}

// Structural, not `Instance<typeof baseStateModelFactory>`: the factory calls
// these builders, so importing its inferred model type back here would be a
// circular type reference. Safe as a mirror in a way the old component-side one
// wasn't — the model is passed in at the call site, so a renamed field is a
// compile error there, not a silent runtime undefined. Same idiom as
// LinearMultiRowFeatureDisplay/trackMenuItems.ts.
export interface FeatureMenuSelf extends IStateTreeNode {
  contextMenuInfo: FeatureContextMenuInfo | undefined
  // what this track holds, singular and lowercase — see the canvas base's
  // featureNoun getter. Every label below that names the clicked thing
  // generically reads it, so a variant track says "variant".
  featureNoun: string
  loadedRegions: { get: (displayedRegionIndex: number) => Region | undefined }
  pinnedFeatureIdSet: ReadonlySet<string>
  highlightedFeatureIdSet: ReadonlySet<string>
  soloFeatureIdSet: ReadonlySet<string>
  soloFeatureCount: number
  soloApplied: boolean
  // the display's declared narrowings; this menu offers the hidden-features one
  featureNarrowings: () => Reversibles
  selectFeatureById: (
    featureId: string,
    subfeatureInfo: SubfeatureInfo | undefined,
    displayedRegionIndex: number,
  ) => void
  fetchFullFeature: (
    featureId: string,
    displayedRegionIndex: number,
  ) => Promise<Feature | undefined>
  // read by the FeatureSequenceDialog this menu queues (it drives the LGV
  // crosshair from the sequence panel's hovered base)
  setSequenceHoverPosition: (pos: SequenceHoverPosition | undefined) => void
  addFeatureHighlightForItem: (target: HighlightTarget, refName: string) => void
  removeFeatureHighlightsForId: (featureId: string) => void
  togglePinnedFeature: (featureId: string) => void
  toggleSoloFeature: (featureId: string) => void
  soloFeature: (featureId: string) => void
  hideFeature: (featureId: string) => void
  clearSolo: () => void
}

// The "Show N hidden features" row, taken from the display's own declaration
// (see `featureNarrowings`) rather than rebuilt here. Both this menu and the
// track menu's filter submenu offer it, and building it twice is how a label and
// a gate drift; picking the one entry out of the record is what the record shape
// is for.
//
// Guarded rather than asserted: `featureNarrowings` is the documented subclass
// seam, and a subclass rebuilding the record without this key would hand
// `undoItems` an `[undefined]` to read `.count` off. No row is the honest answer
// for a display that declares no hidden set.
function showHiddenFeaturesMenuItems(self: FeatureMenuSelf): MenuItem[] {
  const { hiddenFeatures } = self.featureNarrowings()
  return hiddenFeatures ? undoItems({ hiddenFeatures }) : []
}

// A group of rows, or the single row itself when only one applies — a submenu
// wrapping one item is pure indirection, and the user has to hover into it to
// find out there was nothing to choose between. The rows keep their own labels
// when promoted, which is why every one of them reads as a complete instruction
// ("Copy tooltip text", "Highlight variant") rather than leaning on the group
// above it to finish the sentence.
//
// Both groups below collapse this way and each used to say so at length in its
// own words. Core states the same rule for "Filter by..." but cannot share this:
// there the singleton takes the GROUP's label, since the row it promotes is a
// bare dialog opener.
function groupOrSingleRow(
  group: { label: string; icon: ElementType },
  rows: MenuItem[],
): MenuItem[] {
  return rows.length === 1 ? rows : [{ ...group, subMenu: rows }]
}

// What every group below is built from: the model to act on, the right-click
// that opened the menu, and the nouns naming its two scopes. Derived once here
// so no group re-derives them.
interface MenuContext {
  self: FeatureMenuSelf
  info: FeatureContextMenuInfo
  // Name each scope by its own type rather than hardcoding
  // "transcript"/"gene": subfeatureInfos carries more than transcripts (a
  // transposon's LTR parts, mature-protein regions), so fixed wording would
  // mislabel those. These name the ANNOTATION under the cursor ("mRNA",
  // "gene"); `self.featureNoun` names what the track holds generally, and is
  // what an untyped hit falls back to.
  hitNoun: string
  subfeatureNoun: string
}

// The feature right-click menu, one group of items per line. Empty unless a
// right-click landed on a feature (`contextMenuInfo`), which also carries the
// subfeature under the cursor when there was one, so each item can act on the
// exact isoform aimed at.
export function featureContextMenuItems(self: FeatureMenuSelf): MenuItem[] {
  const info = self.contextMenuInfo
  if (info) {
    const ctx: MenuContext = {
      self,
      info,
      hitNoun: info.item.type ?? self.featureNoun,
      subfeatureNoun: info.subfeature?.type ?? 'subfeature',
    }
    return [
      ...inspectItems(ctx),
      ...highlightItems(ctx),
      showHideItem(ctx),
      ...copyItems(ctx),
    ]
  }
  return []
}

// The three ways in to the feature itself.
//
// "Open feature details" and "Zoom to feature" deliberately stay whole-feature
// even when the click resolved to a subfeature, unlike Get sequence and
// Highlight. They are the only way to reach the containing gene: a left-click
// already opens the isoform (selectFeatureById resolves the subfeature), and on
// a gene glyph the transcripts' hit boxes cover the whole span — introns
// included — so there's no pixel that means "the gene". Don't narrow them to
// the subfeature to match the rest of the menu; that removes the gene scope
// rather than adding one.
function inspectItems({ self, info }: MenuContext): MenuItem[] {
  const {
    item: { featureId, startBp, endBp },
    subfeature,
    displayedRegionIndex,
  } = info
  return [
    {
      label: `Open ${self.featureNoun} details`,
      icon: MenuOpenIcon,
      onClick: () => {
        self.selectFeatureById(featureId, undefined, displayedRegionIndex)
      },
    },
    {
      label: `Zoom to ${self.featureNoun}`,
      icon: CenterFocusStrongIcon,
      onClick: () => {
        const view = containingLgv(self)
        // `displayedRegions`, not `loadedRegions`: `displayedRegionIndex` is an
        // index into it, and it is the set `navTo` resolves against. Resolved on
        // click, not while building the menu, since either can be swapped out
        // from under an open menu.
        const region = view.displayedRegions[displayedRegionIndex]
        if (!region) {
          return
        }
        // navTo takes a span wholly inside ONE displayed region and THROWS
        // otherwise, so clamp to the region this hit was drawn in. A feature
        // wider than the region containing it is routine: a collapsed-introns
        // view (which this display's own "Collapse introns" builds) shows a
        // gene's exons as separate regions, so the gene's full span is inside
        // none of them and this threw `could not find a region that contained
        // ...` out of the onClick — no navigation, nothing said. Clamping zooms
        // to the part of the feature that region shows; where the feature fits,
        // which is every ordinary whole-chromosome view, it is a no-op.
        const start = Math.max(startBp, region.start)
        // `featureSpanEndBp` so a zero-length feature zooms to the base it is
        // painted at, rather than failing the guard below and doing nothing
        const end = Math.min(featureSpanEndBp(startBp, endBp), region.end)
        if (end > start) {
          // grow 0.2 adds ~20% flanks so the feature isn't pinned to
          // the viewport edges (matches synteny/bookmark zoom-to).
          view.navTo({ refName: region.refName, start, end }, 0.2)
        }
      },
    },
    // The feature-aware sequence panel (CDS, cDNA, protein, collapsed
    // introns), not the region-based rubberband "Get sequence" dialog:
    // right-clicking a gene and getting only its raw genomic span, with
    // no protein option, is the confusing half of that overlap.
    {
      label: 'Get sequence',
      icon: BiotechIcon,
      onClick: () => {
        const region = self.loadedRegions.get(displayedRegionIndex)
        if (region) {
          getDialogHost(self).queueDialog(handleClose => [
            FeatureSequenceDialog,
            {
              model: self,
              // `item.featureId`, never `subfeature.parentFeatureId`: the
              // panel fetches this id and GetCanvasFeatureDetails resolves
              // top-level features only, while a subfeature names whichever
              // feature it hangs off. The two agree today, but only `item`
              // carries that as a guarantee; the panel descends recursively to
              // `featureId` from whatever it gets, so the root always works.
              parentFeatureId: featureId,
              featureId: subfeature?.featureId ?? featureId,
              displayedRegionIndex,
              assemblyName: region.assemblyName,
              handleClose,
            },
          ])
        }
      },
    },
  ]
}

// One highlight toggle: when the target is already boxed, remove by its id;
// otherwise add a highlight for it. Shared by both scopes below.
function highlightItem(
  { self, info }: MenuContext,
  addLabel: string,
  removeLabel: string,
  target: HighlightTarget,
): MenuItem {
  const active = self.highlightedFeatureIdSet.has(target.featureId)
  return {
    label: active ? removeLabel : addLabel,
    icon: Highlighter,
    onClick: () => {
      if (active) {
        self.removeFeatureHighlightsForId(target.featureId)
      } else {
        const region = self.loadedRegions.get(info.displayedRegionIndex)
        if (region) {
          self.addFeatureHighlightForItem(target, region.refName)
        }
      }
    },
  }
}

// Two highlight scopes. When the click resolved to a subfeature (an isoform, an
// LTR part) both the whole feature and that subfeature can be boxed, so the
// scopes are grouped under a "Highlight" submenu. With no subfeature there is a
// single scope, and groupOrSingleRow keeps it a top-level entry so the common
// case stays one click away.
//
// The lone row names the track's noun ("Highlight variant") while the grouped
// pair names the annotation types ("Whole gene (EDEN)", "mRNA (EDEN.1)"). That
// is the point of the pair — telling the gene from its isoform is the only
// reason there are two rows — whereas the lone row is a sibling of "Hide this
// variant" and "Open variant details" and reads with them.
function highlightItems(ctx: MenuContext): MenuItem[] {
  const { self, info, hitNoun, subfeatureNoun } = ctx
  const {
    item: { featureId, startBp, endBp, name },
    subfeature,
  } = info
  const suffix = name ? ` (${name})` : ''
  const wholeItem = highlightItem(
    ctx,
    subfeature ? `Whole ${hitNoun}${suffix}` : `Highlight ${self.featureNoun}`,
    subfeature
      ? `Remove whole ${hitNoun}${suffix} highlight`
      : 'Remove highlight',
    { startBp, endBp, name, featureId },
  )
  // Named by its own label where it has one ("mRNA (EDEN.1)") — never
  // case-folded, since the nouns come from the annotation's own types
  // (mRNA, ncRNA) where case carries meaning.
  const scope = subfeature?.displayLabel
    ? `${subfeatureNoun} (${subfeature.displayLabel})`
    : undefined
  return groupOrSingleRow({ label: 'Highlight', icon: Highlighter }, [
    // The subfeature scope carries the subfeature's own id, so it resolves to
    // this isoform rather than its gene even when the two share a span (the
    // common GFF3 case).
    ...(subfeature
      ? [
          highlightItem(
            ctx,
            scope ?? `This ${subfeatureNoun}`,
            `Remove ${scope ?? subfeatureNoun} highlight`,
            {
              startBp: subfeature.startBp,
              endBp: subfeature.endBp,
              name: subfeature.displayLabel,
              featureId: subfeature.featureId,
            },
          ),
        ]
      : []),
    wholeItem,
  ])
}

// The show/hide family (pin, solo, hide) groups the growing set of visibility
// toggles behind one submenu so the common actions above stay one click away.
function showHideItem({ self, info }: MenuContext): MenuItem {
  const { featureId } = info.item
  return {
    label: 'Show/hide',
    icon: VisibilityIcon,
    subMenu: [
      {
        label: self.pinnedFeatureIdSet.has(featureId)
          ? 'Unpin from top'
          : 'Pin to top',
        icon: VerticalAlignTopIcon,
        onClick: () => {
          self.togglePinnedFeature(featureId)
        },
      },
      ...soloItems(self, featureId),
      {
        label: `Hide this ${self.featureNoun}`,
        icon: VisibilityOffIcon,
        onClick: () => {
          self.hideFeature(featureId)
        },
      },
      // Reachable from any still-visible feature; the track menu carries the
      // same item under "Edit filters" for the case where everything in view
      // got hidden and there is no feature left to right-click.
      ...showHiddenFeaturesMenuItems(self),
    ],
  }
}

// The show-only list, as three rows that mean the same thing whether or not the
// list is applied yet — narrow to this one, change this one's membership, and
// (once applied) undo the whole thing. Applying a *collected* list is the "N
// selected" badge's job (see SoloSelectionChip), which is why there is no
// "apply" row here.
//
// "Show only this feature" leads in BOTH states, and used to be offered in
// neither once applied: from a collected set it isolates this one, from an
// applied set of several it narrows to this one, and both are `soloFeature`
// replacing the list. Missing, an applied set of six could only be widened back
// to everything and re-collected. Leading in both keeps the row from moving
// under the cursor as the state changes, so clicking where "show only this" was
// can't turn into "show everything again".
//
// One noun throughout — "show-only list" — so these rows and the chip's tooltip
// name the same thing. It used to go by "set" in the add/remove rows and "view"
// in the applied one, which read as two unrelated features.
function soloItems(self: FeatureMenuSelf, featureId: string): MenuItem[] {
  const inSoloList = self.soloFeatureIdSet.has(featureId)
  // An applied list holding this feature and nothing else. Both per-feature rows
  // are then `clearSolo` under another name — narrowing to the only member
  // changes nothing, and dropping it empties the list, which un-applies — so
  // only the undo row is offered.
  const onlyThisApplied =
    self.soloApplied && inSoloList && self.soloFeatureCount === 1
  // `soloFeature` REPLACES the list, so a user part-way through collecting loses
  // the rest of what they had ctrl+clicked. That is the row's job — it is the
  // one-click "just this one" — but the collection is only visible as a corner
  // count, so the row says what it costs rather than letting the badge drop from
  // "4 selected" to "Showing 1" unannounced. Applying the collected set intact
  // is the badge's own click.
  const replaces =
    !self.soloApplied && self.soloFeatureCount > 1
      ? `replaces the ${self.soloFeatureCount} selected`
      : undefined
  return [
    ...(onlyThisApplied
      ? []
      : [
          {
            label: withHint(`Show only this ${self.featureNoun}`, replaces),
            icon: FilterAltIcon,
            onClick: () => {
              self.soloFeature(featureId)
            },
          },
          {
            label: inSoloList
              ? 'Remove from show-only list'
              : 'Add to show-only list',
            icon: inSoloList ? PlaylistRemoveIcon : PlaylistAddIcon,
            onClick: () => {
              self.toggleSoloFeature(featureId)
            },
          },
        ]),
    ...(self.soloApplied
      ? [
          {
            label: `Show all ${pluralize(2, self.featureNoun)} again`,
            icon: FilterAltOffIcon,
            onClick: () => {
              self.clearSolo()
            },
          },
        ]
      : []),
  ]
}

// Attributes as JSON, for one of the two scopes: `subfeature` names the isoform
// under the cursor, undefined the whole feature containing it. Taking the
// subfeature itself rather than its id keeps the copied thing and the name on
// the label from being able to disagree.
//
// Always fetches from `featureId` (the top-level id `item` always carries,
// subfeature or not — see FeatureMenuSelf) and descends when a subfeature is
// targeted, the same route selectFeatureById uses.
function copyJsonItem(
  { self, info, hitNoun, subfeatureNoun }: MenuContext,
  subfeature: SubfeatureInfo | undefined,
): MenuItem {
  const {
    item: { featureId, name },
    displayedRegionIndex,
  } = info
  const wholeScope = name ?? hitNoun
  const scope = subfeature
    ? (subfeature.displayLabel ?? `this ${subfeatureNoun}`)
    : wholeScope
  return {
    label: `Copy ${scope} attributes (JSON)`,
    icon: ContentCopyIcon,
    onClick: () => {
      // `withFeatureDetails` owns the isAlive guard and the empty-lookup notice:
      // the track can be unticked while the fetch is in flight, and `copyText`
      // reaches `getSession(self)`, which throws on a detached node — here as an
      // unhandled rejection, since the body is a floating promise.
      void withFeatureDetails(
        self,
        () => self.fetchFullFeature(featureId, displayedRegionIndex),
        parent => {
          const target = subfeature
            ? findSubfeatureById(parent, subfeature.featureId)
            : parent
          // Both sides take the ids from the same layout pass, so a miss means
          // the fetched feature disagrees with what was drawn. Copy the
          // containing feature rather than nothing, but say that's what landed
          // instead of claiming the isoform.
          const { uniqueId: _, ...rest } = (target ?? parent).toJSON()
          void copyText(
            self,
            JSON.stringify(rest, null, 4),
            `${target ? scope : wholeScope} attributes`,
          )
        },
      )
    },
  }
}

// The copy entries would clutter the top level as plain "Copy …" items, so
// groupOrSingleRow puts them under one submenu — promoting the lone row for a
// nameless feature clicked away from a transcript (no HGVS position, no
// tooltip rows, no subfeature, no refName loaded). The label layer always has a
// tooltip, since a rendered label means the feature had a name.
function copyItems(ctx: MenuContext): MenuItem[] {
  const { self, info } = ctx
  const { subfeature, hgvsLabel, tooltipText, displayedRegionIndex } = info
  const { startBp, endBp } = info.item
  const region = self.loadedRegions.get(displayedRegionIndex)
  const items = [
    // The feature's own span, 1-based and formatted the way the location box
    // reads it back, which is what makes it worth a row of its own: it is the
    // one thing here a user pastes somewhere rather than reads. Absent when the
    // region carrying this hit is no longer loaded, since the refName that
    // names the span comes off it.
    ...(region
      ? [
          copyItem(
            self,
            'Copy location',
            assembleLocString({
              refName: region.refName,
              start: startBp,
              end: endBp,
            }),
            'location',
          ),
        ]
      : []),
    // The clicked base in transcript coordinates, already qualified with the
    // transcript accession and its gene (e.g. `EDEN.1(EDEN):c.93+1` — see
    // hgvsHitLabel), which is how a clinical report names it. Absent — rather
    // than disabled — when the click didn't land on a transcript at base zoom,
    // since there is no honest position to offer then.
    ...(hgvsLabel
      ? [
          copyItem(
            self,
            `Copy HGVS position (${hgvsLabel})`,
            hgvsLabel,
            hgvsLabel,
          ),
        ]
      : []),
    // The exact text the hover tooltip showed for this hit (isoform/gene name,
    // plus exon and HGVS position when the hit resolved to a transcript) —
    // richer than the bare HGVS position above, and reuses what's already
    // computed for the hover rather than re-fetching the feature. Present for
    // nearly every hit (any named feature has at least a title row).
    ...(tooltipText
      ? [copyItem(self, 'Copy tooltip text', tooltipText, 'tooltip text')]
      : []),
    // Scoped the same way as Highlight: with a subfeature under the cursor,
    // offer that isoform by name ahead of the whole gene.
    ...(subfeature ? [copyJsonItem(ctx, subfeature)] : []),
    copyJsonItem(ctx, undefined),
  ]
  return groupOrSingleRow(
    { label: 'Copy to clipboard', icon: ContentCopyIcon },
    items,
  )
}
