import { lazy } from 'react'

import {
  areSlotsAtSessionDefault,
  getConf,
  getConfResolved,
  getSlotInheritedValue,
  isSlotPinned,
  makeCurrentValueSessionDefaultControl,
  readConfObject,
  setSlotsSessionDefault,
} from '@jbrowse/core/configuration'
import { promotableToggleItem } from '@jbrowse/core/ui'
import { getContainingTrack, getSession } from '@jbrowse/core/util'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import HeightIcon from '@mui/icons-material/Height'
import SegmentIcon from '@mui/icons-material/Segment'

import { getTranscripts, hasIntrons } from './CollapseIntronsDialog/util.ts'
import baseStateModelFactory, { getView } from './baseModel.ts'
import { radioSubMenu } from './baseModelHelpers.ts'

const CollapseIntronsDialog = lazy(
  () => import('./CollapseIntronsDialog/CollapseIntronsDialog.tsx'),
)

import type {
  DisplayConfig,
  DisplayMode,
} from '../RenderFeatureDataRPC/renderConfig.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

export type { Region } from '@jbrowse/core/util'

// Single source for the "Set feature height" radio options and the
// "Use ... by default" checkbox label, so a fourth mode can't drift between
// the two.
const displayModeOptions: { value: DisplayMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'compact', label: 'Compact' },
  { value: 'superCompact', label: 'Super-compact' },
]

// Label for a mode; the fallback is unreachable (every DisplayMode is listed
// above) but keeps the lookup total without a non-null assertion.
function displayModeLabel(mode: DisplayMode) {
  return displayModeOptions.find(o => o.value === mode)?.label ?? mode
}

/**
 * #stateModel LinearBasicDisplay
 * GPU-accelerated feature display with gene-specific UI on top of the
 * shared canvas base display (`LinearCanvasBaseDisplay`). This is the GPU
 * stack — despite the name it does NOT extend `BaseLinearDisplay` (the legacy
 * block stack). See agent-docs/ARCHITECTURE.md "Display stacks".
 *
 * #example
 * A complete `FeatureTrack` config (e.g. genes from a GFF3) to paste into
 * `tracks`. `displayMode` sets the feature height preset (`normal`, `compact`,
 * or `superCompact`):
 * ```js
 * {
 *   type: 'FeatureTrack',
 *   trackId: 'genes',
 *   name: 'Genes',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'Gff3TabixAdapter',
 *     uri: 'https://example.com/genes.gff3.gz',
 *   },
 *   displays: [
 *     {
 *       type: 'LinearBasicDisplay',
 *       displayId: 'genes-LinearBasicDisplay',
 *       height: 200,
 *       displayMode: 'compact',
 *     },
 *   ],
 * }
 * ```
 */
export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return baseStateModelFactory(configSchema)
    .props({
      type: types.literal('LinearBasicDisplay'),
      showOnlyGenes: types.stripDefault(types.boolean, false),
    })
    .volatile(() => ({
      /**
       * #volatile
       */
      isoformCollapseNoticeDismissed: false,
    }))
    .views(self => ({
      get subfeatureLabels() {
        return getConf(self, 'subfeatureLabels')
      },

      get geneGlyphMode() {
        return getConf(self, 'geneGlyphMode')
      },

      // Promotable `maybeBoolean` slot (see baseConfigSchema.ts): getConfResolved
      // walks the cascade (pinned track value -> session default -> base `true`)
      // and always yields a concrete boolean, never the unset sentinel.
      get displayDirectionalChevrons(): boolean {
        return getConfResolved(self, 'displayDirectionalChevrons')
      },

      // true when the current displayMode is already the session-wide default
      // for this display type (drives the "make default" checkbox + toggle)
      get isDisplayModeDefault() {
        return areSlotsAtSessionDefault(self, ['displayMode'])
      },

      // true when this track pins an explicit mode rather than inheriting the
      // session default; drives which "Set feature height" radio is checked
      // (the pinned mode vs the top "Default" entry).
      get isDisplayModePinned() {
        return isSlotPinned(self, 'displayMode')
      },

      // the mode an un-pinned track would follow (session default, else base);
      // labels the "Default (X)" radio entry even while this track is pinned.
      get inheritedDisplayMode(): DisplayMode {
        return getSlotInheritedValue<DisplayMode>(self, 'displayMode')
      },

      get effectiveGeneGlyphMode(): DisplayConfig['geneGlyphMode'] {
        if (this.geneGlyphMode === 'auto') {
          // coarseBpPerPx (debounced) so crossing the threshold during a zoom
          // gesture doesn't thrash the RPC cache key — the collapse refetch
          // fires once zoom settles, on the same cadence as the layout.
          return getView(self).coarseBpPerPx > 100 ? 'longestCoding' : 'all'
        }
        return this.geneGlyphMode
      },

      get showIsoformCollapseNotice() {
        // only surface the notice when the collapse was AUTOMATIC (auto mode
        // crossing the zoom threshold) — when a session/user explicitly picks
        // 'longestCoding' they already know isoforms are folded, so the notice
        // is redundant clutter
        return (
          this.geneGlyphMode === 'auto' &&
          !self.isoformCollapseNoticeDismissed &&
          [...self.rpcDataMap.values()].some(data => data.isoformsCollapsed)
        )
      },

      get isGeneLike() {
        const type = (self.contextMenuInfo?.item.type ?? '').toLowerCase()
        return (
          type.includes('gene') ||
          type.includes('rna') ||
          type.includes('transcript')
        )
      },
    }))
    .views(self => {
      const { rpcProps: superRpcProps } = self
      return {
        rpcProps() {
          const base = superRpcProps()
          return {
            ...base,
            displayConfig: {
              ...base.displayConfig,
              geneGlyphMode: self.effectiveGeneGlyphMode,
              // resolved promotable value (base rpcProps excludes the raw
              // sentinel); the worker draws chevron geometry from this
              displayDirectionalChevrons: self.displayDirectionalChevrons,
            },
            showOnlyGenes: self.showOnlyGenes,
          }
        },
      }
    })
    .actions(self => ({
      setSubfeatureLabels(value: DisplayConfig['subfeatureLabels']) {
        self.configuration.setSlot('subfeatureLabels', value)
      },

      setGeneGlyphMode(value: DisplayConfig['geneGlyphMode']) {
        self.configuration.setSlot('geneGlyphMode', value)
      },

      setDisplayMode(value: DisplayMode) {
        self.setSqueezeToDisplayHeight(false)
        self.configuration.setSlot('displayMode', value)
      },

      // Revert to 'inherit' (the slot default), which strips the pin so the
      // track follows the session-wide type default again.
      resetDisplayMode() {
        self.setSqueezeToDisplayHeight(false)
        self.configuration.setSlot('displayMode', 'inherit')
      },

      setCompactness(level: 'normal' | 'compact' | 'super-compact') {
        self.setSqueezeToDisplayHeight(false)
        self.configuration.setSlot(
          'displayMode',
          level === 'super-compact' ? 'superCompact' : level,
        )
      },

      // Promote (or clear) the current displayMode as the session-wide default
      // for this display type (persisted via preferences). Every open track at
      // the schema default picks this up reactively through the displayMode
      // getter; tracks with an explicit per-track choice keep it.
      setDisplayModeDefault(promote: boolean) {
        setSlotsSessionDefault(self, ['displayMode'], promote)
      },

      setShowOnlyGenes(value: boolean) {
        self.showOnlyGenes = value
      },

      setDisplayDirectionalChevrons(value: boolean) {
        self.configuration.setSlot('displayDirectionalChevrons', value)
      },

      dismissIsoformCollapseNotice() {
        self.isoformCollapseNoticeDismissed = true
      },
    }))
    .views(self => {
      const superShowSubmenuMenuItems = self.showSubmenuMenuItems
      const superTrackMenuItems = self.trackMenuItems
      const superContextMenuItems = self.contextMenuItems
      return {
        // Append gene-specific toggles to the base "Show..." submenu.
        showSubmenuMenuItems() {
          return [
            ...superShowSubmenuMenuItems(),
            {
              label: 'Show subfeature labels',
              type: 'checkbox' as const,
              checked: self.subfeatureLabels !== 'none',
              onClick: () => {
                self.setSubfeatureLabels(
                  self.subfeatureLabels === 'none' ? 'overlay' : 'none',
                )
              },
            },
            {
              label: 'Show only genes',
              type: 'checkbox' as const,
              checked: self.showOnlyGenes,
              onClick: () => {
                self.setShowOnlyGenes(!self.showOnlyGenes)
              },
            },
            promotableToggleItem({
              label: 'Show chevrons',
              checked: self.displayDirectionalChevrons,
              onToggle: () => {
                self.setDisplayDirectionalChevrons(
                  !self.displayDirectionalChevrons,
                )
              },
              sessionDefault: makeCurrentValueSessionDefaultControl(self, [
                'displayDirectionalChevrons',
              ]),
            }),
          ]
        },

        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              icon: SegmentIcon,
              ...radioSubMenu(
                'Gene glyph',
                self.geneGlyphMode,
                [
                  { value: 'auto', label: 'Auto' },
                  { value: 'all', label: 'All transcripts' },
                  {
                    value: 'longestCoding',
                    label: 'Longest coding transcript',
                  },
                ],
                value => {
                  self.setGeneGlyphMode(value)
                },
              ),
            },
            {
              icon: HeightIcon,
              label: 'Set feature height',
              // One radio group. The top "Default" entry follows the session
              // default (un-pins); each explicit mode pins the track. Below it,
              // one checkbox promotes the current mode as the session default.
              // Squeeze-to-height and an explicit/default display mode are one
              // exclusive choice, so squeeze wins the radio state when it's on.
              subMenu: [
                {
                  label: `Default (${displayModeLabel(self.inheritedDisplayMode)})`,
                  type: 'radio' as const,
                  checked:
                    !self.squeezeToDisplayHeight && !self.isDisplayModePinned,
                  onClick: () => {
                    self.resetDisplayMode()
                  },
                },
                ...displayModeOptions.map(option => ({
                  label: option.label,
                  type: 'radio' as const,
                  checked:
                    !self.squeezeToDisplayHeight &&
                    self.isDisplayModePinned &&
                    self.displayMode === option.value,
                  onClick: () => {
                    self.setDisplayMode(option.value)
                  },
                })),
                {
                  label: 'Fit to display height',
                  type: 'radio' as const,
                  checked: self.squeezeToDisplayHeight,
                  onClick: () => {
                    self.setSqueezeToDisplayHeight(true)
                  },
                },
                { type: 'divider' as const },
                {
                  label: `Use "${displayModeLabel(self.displayMode)}" as the default for feature tracks`,
                  type: 'checkbox' as const,
                  checked: self.isDisplayModeDefault,
                  onClick: () => {
                    self.setDisplayModeDefault(!self.isDisplayModeDefault)
                  },
                },
              ],
            },
          ]
        },

        contextMenuItems() {
          const base = superContextMenuItems()
          const info = self.contextMenuInfo
          if (!info || !self.isGeneLike) {
            return base
          }
          const {
            item: { featureId },
            displayedRegionIndex,
          } = info
          return [
            ...base,
            {
              label: 'Collapse introns',
              icon: CloseFullscreenIcon,
              onClick: async () => {
                const session = getSession(self)
                const fullFeature = await self.fetchFullFeature(
                  featureId,
                  displayedRegionIndex,
                )
                // isAlive guards against the display being closed while
                // fetchFullFeature was in flight; getView/getContainingTrack
                // below would throw on a detached node.
                if (!fullFeature || !isAlive(self)) {
                  return
                }
                const transcripts = getTranscripts(fullFeature)
                if (!hasIntrons(transcripts)) {
                  session.notify('No introns found in this feature', 'info')
                  return
                }
                const view = getView(self)
                const assemblyName = view.assemblyNames[0]
                const assembly = assemblyName
                  ? session.assemblyManager.get(assemblyName)
                  : undefined
                if (assembly) {
                  const trackId = readConfObject(
                    getContainingTrack(self).configuration,
                    'trackId',
                  )
                  session.queueDialog(handleClose => [
                    CollapseIntronsDialog,
                    {
                      view,
                      transcripts,
                      handleClose,
                      assembly,
                      featureId,
                      trackId,
                    },
                  ])
                }
              },
            },
          ]
        },
      }
    })
}

type LinearBasicDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearBasicDisplayModel = Instance<LinearBasicDisplayStateModel>
