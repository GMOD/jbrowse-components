import { lazy } from 'react'

import { Highlighter } from '@jbrowse/core/ui/Icons'
import { getContainingView, getSession } from '@jbrowse/core/util'
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

// Structural, not `Instance<typeof baseStateModelFactory>`: the factory calls
// these builders, so importing its inferred model type back here would be a
// circular type reference. Safe as a mirror in a way the old component-side one
// wasn't — the model is passed in at the call site, so a renamed field is a
// compile error there, not a silent runtime undefined. Same idiom as
// LinearMultiRowFeatureDisplay/trackMenuItems.ts.
export interface FeatureMenuSelf extends IAnyStateTreeNode {
  contextMenuInfo:
    | {
        item: FlatbushItem
        subfeature?: SubfeatureInfo
        displayedRegionIndex: number
        clientX: number
        clientY: number
      }
    | undefined
  loadedRegions: { get: (displayedRegionIndex: number) => Region | undefined }
  pinnedFeatureIdSet: ReadonlySet<string>
  highlightedFeatureIdSet: ReadonlySet<string>
  soloFeatureIdSet: ReadonlySet<string>
  soloFeatureIds: { length: number }
  soloApplied: boolean
  hiddenFeatureIds: { length: number }
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
  hiddenFeatureIds: { length: number }
  showAllHidden: () => void
}) {
  const n = self.hiddenFeatureIds.length
  return n > 0
    ? [
        {
          label: `Show ${n} hidden feature${n > 1 ? 's' : ''}`,
          icon: VisibilityIcon,
          onClick: () => {
            self.showAllHidden()
          },
        },
      ]
    : []
}

// The feature right-click menu. Empty unless a right-click landed on a feature
// (`contextMenuInfo`), which also carries the subfeature under the cursor when
// there was one, so each item can act on the exact isoform aimed at.
export function featureContextMenuItems(self: FeatureMenuSelf): MenuItem[] {
  const info = self.contextMenuInfo
  if (!info) {
    return []
  }
  const {
    item: { featureId, startBp, endBp, name, type },
    subfeature,
    displayedRegionIndex,
  } = info
  const pinned = self.pinnedFeatureIdSet.has(featureId)
  const highlighted = self.highlightedFeatureIdSet.has(featureId)
  const inSoloSet = self.soloFeatureIdSet.has(featureId)
  const soloCount = self.soloFeatureIds.length
  const subfeatureHighlighted =
    !!subfeature && self.highlightedFeatureIdSet.has(subfeature.featureId)
  // Name each scope by its own type rather than hardcoding
  // "transcript"/"gene": subfeatureInfos carries more than transcripts
  // (a transposon's LTR parts, mature-protein regions), so fixed
  // wording would mislabel those.
  const subfeatureNoun = subfeature?.type ?? 'subfeature'
  const featureNoun = type ?? 'feature'
  // One toggle shared by both highlight scopes: when already boxed,
  // remove by the target's id; otherwise add a highlight for the target.
  function highlightItem(
    active: boolean,
    addLabel: string,
    removeLabel: string,
    target: HighlightTarget,
  ) {
    return {
      label: active ? removeLabel : addLabel,
      icon: Highlighter,
      onClick: () => {
        if (active) {
          self.removeFeatureHighlightsForId(target.featureId)
        } else {
          const region = self.loadedRegions.get(displayedRegionIndex)
          if (region) {
            self.addFeatureHighlightForItem(target, region.refName)
          }
        }
      },
    }
  }
  const wholeSuffix = name ? ` (${name})` : ''
  const wholeFeatureItem = highlightItem(
    highlighted,
    subfeature ? `Whole ${featureNoun}${wholeSuffix}` : 'Highlight feature',
    subfeature
      ? `Remove whole ${featureNoun}${wholeSuffix} highlight`
      : 'Remove highlight',
    { startBp, endBp, name, featureId },
  )
  return [
    // These two deliberately stay whole-feature even when the click resolved to
    // a subfeature, unlike Get sequence / Highlight below. They are the only way
    // to reach the containing gene: a left-click already opens the isoform
    // (selectFeatureById resolves the subfeature), and on a gene glyph the
    // transcripts' hit boxes cover the whole span — introns included — so
    // there's no pixel that means "the gene". Don't narrow them to the
    // subfeature to match the rest of the menu; that removes the gene scope
    // rather than adding one.
    {
      label: 'Open feature details',
      icon: MenuOpenIcon,
      onClick: () => {
        self.selectFeatureById(featureId, undefined, displayedRegionIndex)
      },
    },
    {
      label: 'Zoom to feature',
      icon: CenterFocusStrongIcon,
      onClick: () => {
        const region = self.loadedRegions.get(displayedRegionIndex)
        if (region) {
          const view = getContainingView(self) as LinearGenomeViewModel
          // grow 0.2 adds ~20% flanks so the feature isn't pinned to
          // the viewport edges (matches synteny/bookmark zoom-to).
          view.navTo(
            {
              refName: region.refName,
              start: startBp,
              end: endBp,
            },
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
              parentFeatureId: subfeature
                ? subfeature.parentFeatureId
                : featureId,
              featureId: subfeature ? subfeature.featureId : featureId,
              displayedRegionIndex,
              assemblyName: region.assemblyName,
              handleClose,
            },
          ])
        }
      },
    },
    // Two highlight scopes. When the click resolved to a subfeature (an
    // isoform, an LTR part) both the whole feature and that subfeature
    // can be boxed, so the scopes are grouped under a "Highlight"
    // submenu. With no subfeature there is a single scope, kept as a
    // top-level entry so the common case stays one click away.
    ...(subfeature
      ? [
          {
            label: 'Highlight',
            icon: Highlighter,
            subMenu: [
              // The subfeature scope carries the subfeature's own id, so
              // it resolves to this isoform rather than its gene even
              // when the two share a span (the common GFF3 case).
              highlightItem(
                subfeatureHighlighted,
                subfeature.displayLabel
                  ? `${subfeatureNoun} (${subfeature.displayLabel})`
                  : `This ${subfeatureNoun}`,
                subfeature.displayLabel
                  ? `Remove ${subfeatureNoun} (${subfeature.displayLabel}) highlight`
                  : `Remove ${subfeatureNoun} highlight`,
                {
                  startBp: subfeature.startBp,
                  endBp: subfeature.endBp,
                  name: subfeature.displayLabel,
                  featureId: subfeature.featureId,
                },
              ),
              wholeFeatureItem,
            ],
          },
        ]
      : [wholeFeatureItem]),
    // The show/hide family (pin, solo, hide) groups the growing set of
    // visibility toggles behind one submenu so the common actions above
    // stay one click away.
    {
      label: 'Show/hide',
      icon: VisibilityIcon,
      subMenu: [
        {
          label: pinned ? 'Unpin from top' : 'Pin to top of layout',
          icon: VerticalAlignTopIcon,
          onClick: () => {
            self.togglePinnedFeature(featureId)
          },
        },
        // Solo menu. Applying a collected set is done from the "N
        // selected" badge (see SoloSelectionChip), so the menu only
        // ever offers the one-shot single isolate, add/remove-from-set,
        // and show-all.
        //  - applied → show everything again (and optionally drop this)
        //  - otherwise → the one-shot isolate + add/remove this feature
        ...(self.soloApplied
          ? [
              {
                label: 'Show all features',
                icon: FilterAltOffIcon,
                onClick: () => {
                  self.clearSolo()
                },
              },
              ...(inSoloSet && soloCount > 1
                ? [
                    {
                      label: 'Remove this feature from view',
                      icon: PlaylistRemoveIcon,
                      onClick: () => {
                        self.toggleSoloFeature(featureId)
                      },
                    },
                  ]
                : []),
            ]
          : [
              {
                label: 'Show only this feature',
                icon: FilterAltIcon,
                onClick: () => {
                  self.soloFeature(featureId)
                },
              },
              {
                label: inSoloSet ? 'Remove from set' : 'Add to set',
                icon: inSoloSet ? PlaylistRemoveIcon : PlaylistAddIcon,
                onClick: () => {
                  self.toggleSoloFeature(featureId)
                },
              },
            ]),
        {
          label: 'Hide this feature',
          icon: VisibilityOffIcon,
          onClick: () => {
            self.hideFeature(featureId)
          },
        },
        // Reachable from any still-visible feature; the track menu's
        // "Clear filters" covers the case where everything got hidden.
        ...showHiddenFeaturesMenuItems(self),
      ],
    },
    {
      label: 'Copy info to clipboard',
      icon: ContentCopyIcon,
      onClick: () => {
        void (async () => {
          const session = getSession(self)
          const fullFeature = await self.fetchFullFeature(
            featureId,
            displayedRegionIndex,
          )
          if (!fullFeature) {
            return
          }
          try {
            const { uniqueId: _, ...rest } = fullFeature.toJSON()
            const { default: copy } =
              await import('@jbrowse/core/util/copyToClipboard')
            copy(JSON.stringify(rest, null, 4))
            session.notify('Copied to clipboard', 'success')
          } catch (e) {
            console.error(e)
            session.notifyError(`${e}`, e)
          }
        })()
      },
    },
  ]
}
