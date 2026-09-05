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

export interface FeatureContextMenuInfo {
  item: FlatbushItem
  subfeature?: SubfeatureInfo
  hgvsLabel?: string
  tooltipText?: string
  displayedRegionIndex: number
  clientX: number
  clientY: number
}

// Structural rather than the factory's instance type: the factory calls these
// builders, so importing its type back here is a circular reference.
export interface FeatureMenuSelf extends IStateTreeNode {
  contextMenuInfo: FeatureContextMenuInfo | undefined
  featureNoun: string
  loadedRegions: { get: (displayedRegionIndex: number) => Region | undefined }
  pinnedFeatureIdSet: ReadonlySet<string>
  highlightedFeatureIdSet: ReadonlySet<string>
  soloFeatureIdSet: ReadonlySet<string>
  soloFeatureCount: number
  soloApplied: boolean
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
  setSequenceHoverPosition: (pos: SequenceHoverPosition | undefined) => void
  addFeatureHighlightForItem: (target: HighlightTarget, refName: string) => void
  removeFeatureHighlightsForId: (featureId: string) => void
  togglePinnedFeature: (featureId: string) => void
  toggleSoloFeature: (featureId: string) => void
  soloFeature: (featureId: string) => void
  hideFeature: (featureId: string) => void
  clearSolo: () => void
}

// Guarded rather than asserted: a subclass rebuilding `featureNarrowings`
// without this key would hand `undoItems` an undefined to read `.count` off.
function showHiddenFeaturesMenuItems(self: FeatureMenuSelf): MenuItem[] {
  const { hiddenFeatures } = self.featureNarrowings()
  return hiddenFeatures ? undoItems({ hiddenFeatures }) : []
}

// A submenu wrapping one row is pure indirection, so a lone row is promoted
// under its own label.
function groupOrSingleRow(
  group: { label: string; icon: ElementType },
  rows: MenuItem[],
): MenuItem[] {
  return rows.length === 1 ? rows : [{ ...group, subMenu: rows }]
}

interface MenuContext {
  self: FeatureMenuSelf
  info: FeatureContextMenuInfo
  // Named by the annotation's own type: subfeatureInfos carries more than
  // transcripts, so fixed 'transcript'/'gene' wording would mislabel an LTR
  // part.
  hitNoun: string
  subfeatureNoun: string
}

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

// Open details and Zoom to stay whole-feature even when the click resolved to
// a subfeature: on a gene glyph the transcripts' hit boxes cover the whole
// span, so these two are the only way to reach the containing gene.
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
        // `displayedRegions`, not `loadedRegions`: `displayedRegionIndex`
        // indexes it and `navTo` resolves against it.
        const region = view.displayedRegions[displayedRegionIndex]
        if (!region) {
          return
        }
        // `navTo` throws for a span outside one displayed region, and a
        // collapsed-introns view shows a gene's exons as separate regions, so
        // clamp to the region this hit was drawn in.
        const start = Math.max(startBp, region.start)
        // `featureSpanEndBp` so a zero-length feature zooms to the base it is
        // painted at.
        const end = Math.min(featureSpanEndBp(startBp, endBp), region.end)
        if (end > start) {
          view.navTo({ refName: region.refName, start, end }, 0.2)
        }
      },
    },
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
              // `item.featureId`, never `subfeature.parentFeatureId`:
              // GetCanvasFeatureDetails resolves top-level features only, and
              // the panel descends from the root.
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

// The lone row names the track's noun while the grouped pair names the
// annotation types, since telling gene from isoform is the only reason there
// are two rows.
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
  // Never case-folded: the nouns come from the annotation's own types (mRNA,
  // ncRNA), where case carries meaning.
  const scope = subfeature?.displayLabel
    ? `${subfeatureNoun} (${subfeature.displayLabel})`
    : undefined
  return groupOrSingleRow({ label: 'Highlight', icon: Highlighter }, [
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
      ...showHiddenFeaturesMenuItems(self),
    ],
  }
}

// "Show only this feature" leads in both states so the row does not move
// under the cursor as the state changes.
function soloItems(self: FeatureMenuSelf, featureId: string): MenuItem[] {
  const inSoloList = self.soloFeatureIdSet.has(featureId)
  // With an applied list holding only this feature both per-feature rows
  // would be `clearSolo` under another name, so only the undo row is offered.
  const onlyThisApplied =
    self.soloApplied && inSoloList && self.soloFeatureCount === 1
  // `soloFeature` replaces a list still being collected, so the row says what
  // it costs instead of letting the badge drop unannounced.
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
      // `withFeatureDetails` owns the isAlive guard: the track can be
      // unticked mid-fetch, and `copyText` reaches `getSession(self)`, which
      // throws on a detached node.
      void withFeatureDetails(
        self,
        () => self.fetchFullFeature(featureId, displayedRegionIndex),
        parent => {
          const target = subfeature
            ? findSubfeatureById(parent, subfeature.featureId)
            : parent
          // A miss means the fetched feature disagrees with what was drawn;
          // copy the containing feature and say so rather than claiming the
          // isoform.
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

function copyItems(ctx: MenuContext): MenuItem[] {
  const { self, info } = ctx
  const { subfeature, hgvsLabel, tooltipText, displayedRegionIndex } = info
  const { startBp, endBp } = info.item
  const region = self.loadedRegions.get(displayedRegionIndex)
  const items = [
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
    ...(tooltipText
      ? [copyItem(self, 'Copy tooltip text', tooltipText, 'tooltip text')]
      : []),
    ...(subfeature ? [copyJsonItem(ctx, subfeature)] : []),
    copyJsonItem(ctx, undefined),
  ]
  return groupOrSingleRow(
    { label: 'Copy to clipboard', icon: ContentCopyIcon },
    items,
  )
}
