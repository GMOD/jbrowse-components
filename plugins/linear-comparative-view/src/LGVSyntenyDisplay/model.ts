import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import {
  copyFeatureInfo,
  getColorByMenuItem,
  getFeatureHeightMenuItem,
  getFiltersMenuItem,
  getHitMenuItems,
  getSortByMenuItem,
  linearAlignmentsDisplayStateModelFactory,
  pickColorOptions,
  withContextMenuFeature,
} from '@jbrowse/plugin-alignments'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'

import { canLaunchSyntenyForMate } from '../LaunchSyntenyView/buildSyntenyViewSpec.ts'
import { getMate } from '../syntenyMate.ts'
import { resolveDisplayLodMode } from './lodMode.ts'
import { getSyntenyGroupByMenuItem, getSyntenyShowMenuItem } from './menus.ts'

import type { LGVSyntenyDisplayConfigModel } from './configSchemaF.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const LaunchSyntenyViewDialog = lazy(
  () => import('../LaunchSyntenyView/LaunchSyntenyViewDialog.tsx'),
)

/**
 * #stateModel LGVSyntenyDisplay
 * displays location of "synteny" feature in a plain LGV, allowing linking out
 * to external synteny views
 *
 * #example
 * Shows a `SyntenyTrack`'s alignments in a plain linear view (rather than the
 * two-row synteny view). Same track config as a synteny track — just pick this
 * display type:
 * ```js
 * {
 *   type: 'SyntenyTrack',
 *   trackId: 'hg38_vs_mm10',
 *   name: 'hg38 vs mm10',
 *   assemblyNames: ['hg38', 'mm10'],
 *   adapter: {
 *     type: 'PAFAdapter',
 *     uri: 'https://example.com/hg38_vs_mm10.paf',
 *     queryAssembly: 'hg38',
 *     targetAssembly: 'mm10',
 *   },
 *   displays: [
 *     {
 *       type: 'LGVSyntenyDisplay',
 *       displayId: 'hg38_vs_mm10-LGVSyntenyDisplay',
 *     },
 *   ],
 * }
 * ```
 */
function stateModelFactory(schema: LGVSyntenyDisplayConfigModel) {
  const baseModel = linearAlignmentsDisplayStateModelFactory(schema)
  return (
    types
      .compose(
        'LGVSyntenyDisplay',
        baseModel,
        types.model({
          /**
           * #property
           */
          type: types.literal('LGVSyntenyDisplay'),
          /**
           * #property
           */
          configuration: ConfigurationReference(schema),
        }),
      )
      // showCoverage defaults to false for synteny via the config-slot override
      // in configSchemaF (the base alignments display defaults it to true).
      .views(() => ({
        /**
         * #getter
         * synteny features open the SyntenyFeatureWidget; the inherited
         * `selectFeature` action reads this getter, so no override is needed.
         */
        get featureWidgetType() {
          return {
            type: 'SyntenyFeatureWidget',
            id: 'syntenyFeature',
          }
        },

        /**
         * #getter
         * A row here is a PAF block, not a read — the group-label chips say
         * "Show all features". Matches the `noun` the menu builders below are
         * passed.
         */
        get featureNoun() {
          return 'feature'
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Whether the view's own assembly lane is hidden — see the slot.
         */
        get hideSelfAlignments(): boolean {
          return getConf(self, 'hideSelfAlignments')
        },

        /**
         * #getter
         * The lane an all-vs-all track draws for the view's own assembly: its
         * mate-assembly group key IS that assembly name. Hidden as a group key
         * rather than filtered out of the fetch, so unchecking the option shows
         * it again without a refetch.
         */
        get hiddenGroupKeys(): ReadonlySet<string> {
          const view = getContainingView(self) as LinearGenomeViewModel
          const assemblyName = view.assemblyNames[0]
          return this.hideSelfAlignments &&
            self.groupBy?.type === 'mateAssembly' &&
            assemblyName !== undefined
            ? new Set([assemblyName])
            : new Set()
        },
      }))
      .views(self => {
        const superRpcProps = self.rpcProps
        return {
          /**
           * #method
           * Adds the detail tier to the base alignments RPC payload — see
           * `resolveDisplayLodMode` for why the display resolves it rather than
           * forwarding `bpPerPx` to the adapter.
           */
          rpcProps() {
            // via the slot path rather than `self.adapterConfig`, which is a
            // snapshot and so carries only explicitly-set keys — the threshold
            // read undefined for every track that leaves it at its default,
            // which is nearly all of them, and the tier was never sent. An
            // adapter with no tiering has no such slot and reads undefined here,
            // which is the "send no lodMode" case.
            const threshold: unknown = getConf(self.parentTrack, [
              'adapter',
              'coarseBpPerPxThreshold',
            ])
            return {
              ...superRpcProps(),
              lodMode: resolveDisplayLodMode({
                bpPerPx: (getContainingView(self) as LinearGenomeViewModel)
                  .bpPerPx,
                coarseBpPerPxThreshold:
                  typeof threshold === 'number' ? threshold : undefined,
              }),
            }
          },
        }
      })
      .actions(self => ({
        /**
         * #action
         * Show/hide the view's own assembly lane of an all-vs-all track.
         */
        setHideSelfAlignments(flag: boolean) {
          setConf(self, 'hideSelfAlignments', flag)
          self.scrollTop = 0
        },
      }))
      .views(self => ({
        /**
         * #method
         */
        contextMenuItems() {
          // The mismatch / interbase-indicator details come from the base
          // alignments display: this display renders those same layers off the
          // PAF cs/CIGAR (see its "Show..." menu), so a right-click on one has
          // to reach its details — before this, a right-click on an interbase
          // indicator (which carries no feature) produced no menu at all. The
          // read-specific half of the base menu (mate, read/HP/RG filters, read
          // name + sequence copies) is what a PAF block has no answer for, and
          // is replaced by the feature items below. `sort: false` because the
          // curated "Sort by..." menu offers no position-anchored mode.
          const items: MenuItem[] = getHitMenuItems(self, { sort: false })
          // Keyed on the id, which the hit test carries, rather than on
          // `contextMenuFeature`, which arrives an RPC later: a right-click on a
          // CIGAR op otherwise opened a menu holding only its hit item, and the
          // feature items appeared afterwards (or, on a whole-block re-read,
          // long afterwards). What actually needs the feature resolves it in its
          // own onClick — normally already in hand by then.
          const featureId = self.contextMenuFeatureId
          if (featureId !== undefined) {
            const feature = self.contextMenuFeature
            items.push(
              {
                label: 'Open feature details',
                icon: MenuOpenIcon,
                onClick: () => {
                  withContextMenuFeature(self, featureId, feature, feat => {
                    self.selectFeature(feat)
                  })
                },
              },
              {
                label: 'Copy info to clipboard',
                icon: ContentCopyIcon,
                onClick: () => {
                  withContextMenuFeature(self, featureId, feature, feat => {
                    copyFeatureInfo(self, feat)
                  })
                },
              },
            )
            // The one item that can't be offered from the id alone: whether a
            // synteny view can open depends on the mate's assembly, which is
            // per-feature (a one-vs-all mate can be a PanSN sample that is no
            // declared assembly of the track). So it waits for the fetch rather
            // than offering a view that would fail to open — and sits last, so
            // arriving late appends to the menu instead of shifting the items
            // already under the cursor.
            // The anchor panel opens on the view's own assembly, which is what
            // the features were fetched against — more dependable than the
            // feature's own `assemblyName` field, which not every adapter sets.
            const anchorAssembly = (
              getContainingView(self) as LinearGenomeViewModel
            ).assemblyNames[0]
            if (
              feature &&
              anchorAssembly !== undefined &&
              canLaunchSyntenyForMate(
                getConf(getContainingTrack(self), 'assemblyNames'),
                getMate(feature)?.assemblyName,
              )
            ) {
              // The visible block the user right-clicked in, which the launch
              // dialog offers to clip the synteny view to. Snapshotted here
              // rather than read in the onClick because closeContextMenu nulls
              // it first, and taken from the click rather than searched for by
              // refName: a feature abutting a region boundary overlaps two
              // visible blocks, and only the cursor says which one it was drawn
              // in.
              const block = self.contextMenuBlock
              items.push({
                label: 'Launch synteny view for this position',
                icon: CompareArrowsIcon,
                onClick: () => {
                  getSession(self).queueDialog(handleClose => [
                    LaunchSyntenyViewDialog,
                    {
                      region: block
                        ? { start: block.bpRange[0], end: block.bpRange[1] }
                        : undefined,
                      trackId: getConf(getContainingTrack(self), 'trackId'),
                      handleClose,
                      session: getSession(self),
                      anchorAssembly,
                      feature,
                    },
                  ])
                },
              })
            }
          }
          return items
        },
        /**
         * #method
         */
        // Every entry is a submenu, in the same order as the alignments display's
        // track menu (color, sort, filter, group, show, height) — the two share a
        // state model and a component, so the menus should read the same way. The
        // per-setting curation (which color schemes, which sort modes, which
        // layers) is what makes this synteny's menu rather than a copy.
        trackMenuItems() {
          return [
            // Paired-end and modification/bisulfite coloring are deliberately
            // not opted into: a PAF block has no mate pair and no basecaller
            // tags. 'mateRefName' ("Query name") is the synteny-only scheme —
            // chromosome painting, matching the synteny view's Query mode.
            getColorByMenuItem(self, {
              colorOptions: pickColorOptions(
                'normal',
                'strand',
                'mappingQuality',
                'mateRefName',
              ),
            }),
            // No base pair / tag: a PAF block has no per-base sequence to sort a
            // column by, and no SAM tags. 'Longest features first' is the
            // largeFeaturesFirst layout flag, folded in as a peer radio because
            // it competes with a real sort for the same ordering.
            getSortByMenuItem(self, {
              noun: 'feature',
              modes: ['position', 'length', 'strand'],
            }),
            getFiltersMenuItem(self),
            getSyntenyGroupByMenuItem(self),
            getSyntenyShowMenuItem(self),
            getFeatureHeightMenuItem(self, 'feature'),
          ] satisfies MenuItem[]
        },
      }))
  )
}

export default stateModelFactory
