import { lazy } from 'react'

import { Highlighter } from '@jbrowse/core/ui/Icons'
import { getContainingView, getSession, pluralize } from '@jbrowse/core/util'
import { copyText } from '@jbrowse/core/util/copyText'
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

import { findSubfeatureById } from './baseModelHelpers.ts'

import type {
  FlatbushItem,
  SubfeatureInfo,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { HighlightTarget } from './featureHighlight.ts'
import type { SequenceHoverPosition } from '@jbrowse/core/BaseFeatureWidget'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature, Region } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
export interface FeatureMenuSelf extends IAnyStateTreeNode {
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
  hiddenFeatureCount: number
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
  showAllHidden: () => void
}

// The "Show N hidden features" recovery item, shared by the feature context
// menu (Show/hide submenu) and the track menu (Edit filters submenu). Empty
// when nothing is hidden.
export function showHiddenFeaturesMenuItems(self: {
  featureNoun: string
  hiddenFeatureCount: number
  showAllHidden: () => void
}): MenuItem[] {
  const n = self.hiddenFeatureCount
  return n > 0
    ? [
        {
          label: `Show ${n} hidden ${pluralize(n, self.featureNoun)}`,
          icon: VisibilityIcon,
          onClick: () => {
            self.showAllHidden()
          },
        },
      ]
    : []
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
        // resolved on click, not while building the menu: a refetch can swap
        // loadedRegions out from under an open menu
        const region = self.loadedRegions.get(displayedRegionIndex)
        if (region) {
          const view = getContainingView(self) as LinearGenomeViewModel
          // grow 0.2 adds ~20% flanks so the feature isn't pinned to
          // the viewport edges (matches synteny/bookmark zoom-to).
          view.navTo(
            { refName: region.refName, start: startBp, end: endBp },
            0.2,
          )
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
          getSession(self).queueDialog(handleClose => [
            FeatureSequenceDialog,
            {
              model: self,
              parentFeatureId: subfeature?.parentFeatureId ?? featureId,
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
// single scope, kept as a top-level entry so the common case stays one click
// away.
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
  if (subfeature) {
    // Named by its own label where it has one ("mRNA (EDEN.1)") — never
    // case-folded, since the nouns come from the annotation's own types
    // (mRNA, ncRNA) where case carries meaning.
    const scope = subfeature.displayLabel
      ? `${subfeatureNoun} (${subfeature.displayLabel})`
      : undefined
    return [
      {
        label: 'Highlight',
        icon: Highlighter,
        subMenu: [
          // The subfeature scope carries the subfeature's own id, so it
          // resolves to this isoform rather than its gene even when the two
          // share a span (the common GFF3 case).
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
          wholeItem,
        ],
      },
    ]
  }
  return [wholeItem]
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

// Applying a collected list is done from the "N selected" badge (see
// SoloSelectionChip), so this only ever offers:
//  - applied → show everything again (and optionally drop this feature)
//  - otherwise → the one-shot isolate + add/remove this feature
//
// One noun throughout — "show-only list" — so these rows and the chip's tooltip
// name the same thing. It used to go by "set" in the add/remove rows and "view"
// in the applied one, which read as two unrelated features.
function soloItems(self: FeatureMenuSelf, featureId: string): MenuItem[] {
  const inSoloList = self.soloFeatureIdSet.has(featureId)
  const removeFromList = {
    label: 'Remove from show-only list',
    icon: PlaylistRemoveIcon,
    onClick: () => {
      self.toggleSoloFeature(featureId)
    },
  }
  const allNoun = pluralize(2, self.featureNoun)
  return self.soloApplied
    ? [
        {
          label: `Show all ${allNoun} again`,
          icon: FilterAltOffIcon,
          onClick: () => {
            self.clearSolo()
          },
        },
        // Removing the only remaining one would empty the view, which
        // "Show all ... again" above already covers.
        ...(inSoloList && self.soloFeatureCount > 1 ? [removeFromList] : []),
      ]
    : [
        {
          label: `Show only this ${self.featureNoun}`,
          icon: FilterAltIcon,
          onClick: () => {
            self.soloFeature(featureId)
          },
        },
        inSoloList
          ? removeFromList
          : {
              label: 'Add to show-only list',
              icon: PlaylistAddIcon,
              onClick: () => {
                self.toggleSoloFeature(featureId)
              },
            },
      ]
}

// One item that copies `text`, naming what landed in both the menu and the
// confirmation.
function copyItem(
  self: FeatureMenuSelf,
  label: string,
  text: string,
  what: string,
): MenuItem {
  return {
    label,
    icon: ContentCopyIcon,
    onClick: () => {
      void copyText(self, text, what)
    },
  }
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
      void (async () => {
        const parent = await self.fetchFullFeature(
          featureId,
          displayedRegionIndex,
        )
        if (parent) {
          const target = subfeature
            ? findSubfeatureById(parent, subfeature.featureId)
            : parent
          // Both sides take the ids from the same layout pass, so a miss means
          // the fetched feature disagrees with what was drawn. Copy the
          // containing feature rather than nothing, but say that's what landed
          // instead of claiming the isoform.
          const { uniqueId: _, ...rest } = (target ?? parent).toJSON()
          await copyText(
            self,
            JSON.stringify(rest, null, 4),
            `${target ? scope : wholeScope} attributes`,
          )
        }
      })()
    },
  }
}

// Up to four copy entries would clutter the top level as plain "Copy …" items,
// so they're grouped under one submenu — unless only one applies, where a
// submenu holding a single item is pure indirection. That happens for a
// nameless feature clicked away from a transcript (no HGVS position, no
// tooltip rows, no subfeature); the label layer always has a tooltip, since a
// rendered label means the feature had a name. Every label says "Copy", so an
// item reads the same either way.
function copyItems(ctx: MenuContext): MenuItem[] {
  const { self, info } = ctx
  const { subfeature, hgvsLabel, tooltipText } = info
  const items = [
    // The clicked base in transcript coordinates, already qualified with the
    // transcript accession (e.g. `EDEN.1:c.93+1` — see hgvsHitLabel), which is
    // how a clinical report names it. Absent — rather than disabled — when the
    // click didn't land on a transcript at base zoom, since there is no honest
    // position to offer then.
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
  return items.length === 1
    ? items
    : [{ label: 'Copy to clipboard', icon: ContentCopyIcon, subMenu: items }]
}
