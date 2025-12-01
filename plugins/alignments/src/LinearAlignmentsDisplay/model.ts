import { lazy } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getContainingView, getSession } from '@jbrowse/core/util'
import {
  addDisposer,
  getSnapshot,
  isAlive,
  types,
} from '@jbrowse/mobx-state-tree'
import ColorLensIcon from '@mui/icons-material/ColorLens'
import FilterListIcon from '@mui/icons-material/ClearAll'
import deepEqual from 'fast-deep-equal'
import { autorun } from 'mobx'

import { LinearAlignmentsDisplayMixin } from './alignmentsModel'
import { getLowerPanelDisplays } from './util'
import { getUniqueModifications } from '../shared/getUniqueModifications'
import { modificationData } from '../shared/modificationData'
import { createAutorun } from '../util'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

// lazies
const FilterByTagDialog = lazy(
  () => import('../shared/components/FilterByTagDialog'),
)
const ColorByTagDialog = lazy(
  () => import('../LinearPileupDisplay/components/ColorByTagDialog'),
)
const SetModificationThresholdDialog = lazy(
  () =>
    import('../LinearPileupDisplay/components/SetModificationThresholdDialog'),
)

type LGV = LinearGenomeViewModel

const minDisplayHeight = 20

/**
 * #stateModel LinearAlignmentsDisplay
 * extends
 * - [BaseDisplay](../basedisplay)
 * - [LinearAlignmentsDisplayMixin](../linearalignmentsdisplaymixin)
 */
function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearAlignmentsDisplay',
      BaseDisplay,
      LinearAlignmentsDisplayMixin(pluginManager, configSchema),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      scrollTop: 0,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setScrollTop(scrollTop: number) {
        self.scrollTop = scrollTop
      },

      /**
       * #action
       */
      setSNPCoverageHeight(n: number) {
        self.snpCovHeight = n
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get height() {
        return self.heightPreConfig ?? getConf(self, 'height')
      },

      /**
       * #getter
       */
      get featureIdUnderMouse() {
        return (
          self.PileupDisplay.featureIdUnderMouse ||
          self.SNPCoverageDisplay.featureIdUnderMouse
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get pileupConf() {
        const conf = getConf(self, 'pileupDisplay')
        return {
          ...conf,
          type: self.lowerPanelType,
          displayId: `${self.configuration.displayId}_${self.lowerPanelType}_xyz`, // xyz to avoid someone accidentally naming the displayId similar to this
        }
      },

      /**
       * #method
       */
      getFeatureByID(blockKey: string, id: string) {
        return self.PileupDisplay.getFeatureByID(blockKey, id)
      },
      /**
       * #method
       */
      searchFeatureByID(id: string) {
        return self.PileupDisplay.searchFeatureByID?.(id)
      },

      /**
       * #getter
       */
      get features() {
        return self.PileupDisplay.features
      },

      /**
       * #getter
       */
      get DisplayBlurb() {
        return self.PileupDisplay?.DisplayBlurb
      },

      /**
       * #getter
       */
      get sortedBy() {
        return self.PileupDisplay.sortedBy
      },

      /**
       * #getter
       */
      get coverageConf() {
        const conf = getConf(self, 'snpCoverageDisplay')
        return {
          ...conf,
          displayId: `${self.configuration.displayId}_snpcoverage_xyz`, // xyz to avoid someone accidentally naming the displayId similar to this
        }
      },

      /**
       * #method
       */
      notReady() {
        return (
          self.PileupDisplay?.renderProps().notReady ||
          self.SNPCoverageDisplay?.renderProps().notReady
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setSNPCoverageDisplay(configuration: AnyConfigurationModel) {
        self.SNPCoverageDisplay = {
          type: 'LinearSNPCoverageDisplay',
          configuration,
          height: self.snpCovHeight,
        }
      },
      /**
       * #action
       */
      setFeatureDensityStatsLimit(stats?: FeatureDensityStats) {
        self.PileupDisplay.setFeatureDensityStatsLimit(stats)
        self.SNPCoverageDisplay.setFeatureDensityStatsLimit(stats)
      },

      /**
       * #action
       */
      setPileupDisplay(configuration: AnyConfigurationModel) {
        self.PileupDisplay = {
          type: configuration.type || 'LinearPileupDisplay',
          configuration,
        }
      },
      /**
       * #action
       */
      setHeight(n: number) {
        self.heightPreConfig = Math.max(n, minDisplayHeight)
        return self.heightPreConfig
      },
      /**
       * #action
       */
      setLowerPanelType(type: string) {
        self.lowerPanelType = type
      },
      /**
       * #action
       */
      resizeHeight(distance: number) {
        const oldHeight = self.height
        const newHeight = this.setHeight(self.height + distance)
        return newHeight - oldHeight
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(
            function alignmentsDisplayConfigAutorun() {
              const {
                SNPCoverageDisplay,
                PileupDisplay,
                coverageConf,
                pileupConf,
              } = self

              if (!SNPCoverageDisplay) {
                self.setSNPCoverageDisplay(coverageConf)
              } else if (
                !deepEqual(
                  coverageConf,
                  getSnapshot(SNPCoverageDisplay.configuration),
                )
              ) {
                SNPCoverageDisplay.setHeight(self.snpCovHeight)
                SNPCoverageDisplay.setConfig(self.coverageConf)
              }

              if (
                !PileupDisplay ||
                self.lowerPanelType !== PileupDisplay.type
              ) {
                self.setPileupDisplay(pileupConf)
              } else if (
                !deepEqual(pileupConf, getSnapshot(PileupDisplay.configuration))
              ) {
                PileupDisplay.setConfig(self.pileupConf)
              }
            },
            { name: 'AlignmentsDisplayConfig' },
          ),
        )

        addDisposer(
          self,
          autorun(
            function snpCoverageHeightAutorun() {
              self.setSNPCoverageHeight(self.SNPCoverageDisplay.height)
            },
            { name: 'SNPCoverageHeight' },
          ),
        )

        addDisposer(
          self,
          autorun(
            function pileupHeightAutorun() {
              self.PileupDisplay.setHeight(
                self.height - self.SNPCoverageDisplay.height,
              )
            },
            { name: 'PileupHeight' },
          ),
        )

        // Modifications autorun - runs once for both nested displays
        createAutorun(
          self,
          async () => {
            self.setModificationsReady(false)
            const view = getContainingView(self) as LGV
            if (!view.initialized) {
              return
            }
            const { staticBlocks } = view
            const { colorBy } = self
            if (colorBy?.type === 'modifications') {
              const { modifications, simplexModifications } =
                await getUniqueModifications({
                  model: self,
                  adapterConfig: getConf(self.parentTrack, 'adapter'),
                  blocks: staticBlocks,
                })
              if (isAlive(self)) {
                self.updateVisibleModifications(modifications)
                self.setSimplexModifications(simplexModifications)
                self.setModificationsReady(true)
              }
            } else {
              self.setModificationsReady(true)
            }
          },
          { delay: 1000 },
        )
      },
      /**
       * #action
       */
      async renderSvg(opts: ExportSvgDisplayOptions) {
        const { renderSvg } = await import('./renderSvg')
        return renderSvg(self, opts)
      },
    }))
    .views(self => {
      const { trackMenuItems: superTrackMenuItems } = self
      return {
        /**
         * #getter
         */
        get modificationThreshold() {
          return self.colorBy?.modifications?.threshold ?? 10
        },

        /**
         * #getter
         */
        get visibleModificationTypes() {
          return [...self.visibleModifications.keys()]
        },

        /**
         * #method
         * Generates color scheme submenu items for the Color by menu
         */
        colorSchemeSubMenuItems(): MenuItem[] {
          const { colorBy } = self
          const currentType = colorBy?.type

          const colorTypes = [
            { type: 'normal', label: 'Normal' },
            { type: 'mappingQuality', label: 'Mapping quality' },
            { type: 'strand', label: 'Strand' },
            { type: 'perBaseQuality', label: 'Per-base quality' },
            { type: 'perBaseLettering', label: 'Per-base lettering' },
            { type: 'stranded', label: 'First-of-pair strand' },
            { type: 'pairOrientation', label: 'Pair orientation' },
            { type: 'insertSize', label: 'Insert size' },
          ]

          return [
            ...colorTypes.map(({ type, label }) => ({
              type: 'radio' as const,
              label,
              checked: currentType === type,
              onClick: () => {
                // eslint-disable-next-line no-console
                console.log(`[ColorBy] Setting color scheme to: ${type}`)
                self.setColorScheme({ type })
              },
            })),
            {
              label: 'Color by tag...',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  ColorByTagDialog,
                  { model: self, handleClose },
                ])
              },
            },
          ]
        },

        /**
         * #method
         * Generates modifications submenu for the Color by menu
         */
        modificationsMenuItems(): MenuItem[] {
          const threshold = this.modificationThreshold
          const { colorBy } = self
          const currentType = colorBy?.type
          const currentMods = colorBy?.modifications

          if (!self.modificationsReady) {
            return [{ label: 'Loading modifications...', onClick: () => {} }]
          }

          const isModsSelected = (opts: {
            twoColor?: boolean
            isolatedModification?: string
          }) =>
            currentType === 'modifications' &&
            currentMods?.twoColor === opts.twoColor &&
            currentMods?.isolatedModification === opts.isolatedModification

          return [
            {
              type: 'radio' as const,
              label: `All modifications (>= ${threshold}% prob)`,
              checked: isModsSelected({}),
              onClick: () =>
                self.setColorScheme({
                  type: 'modifications',
                  modifications: { threshold },
                }),
            },
            ...this.visibleModificationTypes.map(key => ({
              type: 'radio' as const,
              label: `Show only ${modificationData[key]?.name || key} (>= ${threshold}% prob)`,
              checked: isModsSelected({ isolatedModification: key }),
              onClick: () =>
                self.setColorScheme({
                  type: 'modifications',
                  modifications: { isolatedModification: key, threshold },
                }),
            })),
            { type: 'divider' } as MenuItem,
            {
              type: 'radio' as const,
              label: 'All modifications (<50% prob colored blue)',
              checked: isModsSelected({ twoColor: true }),
              onClick: () =>
                self.setColorScheme({
                  type: 'modifications',
                  modifications: { twoColor: true, threshold },
                }),
            },
            ...this.visibleModificationTypes.map(key => ({
              type: 'radio' as const,
              label: `Show only ${modificationData[key]?.name || key} (<50% prob colored blue)`,
              checked: isModsSelected({ twoColor: true, isolatedModification: key }),
              onClick: () =>
                self.setColorScheme({
                  type: 'modifications',
                  modifications: {
                    isolatedModification: key,
                    twoColor: true,
                    threshold,
                  },
                }),
            })),
            { type: 'divider' } as MenuItem,
            {
              type: 'radio' as const,
              label: 'All reference CpGs',
              checked: currentType === 'methylation',
              onClick: () =>
                self.setColorScheme({
                  type: 'methylation',
                  modifications: { threshold },
                }),
            },
            { type: 'divider' } as MenuItem,
            {
              label: `Adjust threshold (${threshold}%)`,
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  SetModificationThresholdDialog,
                  { model: self, handleClose },
                ])
              },
            },
          ]
        },

        /**
         * #method
         */
        trackMenuItems(): MenuItem[] {
          if (!self.PileupDisplay) {
            return []
          }
          const extra = getLowerPanelDisplays(pluginManager).map(d => ({
            type: 'radio',
            label: d.displayName,
            checked: d.name === self.PileupDisplay.type,
            onClick: () => {
              self.setLowerPanelType(d.name)
            },
          }))
          return [
            ...superTrackMenuItems(),
            {
              label: 'Color by...',
              icon: ColorLensIcon,
              subMenu: [
                {
                  label: 'Modifications',
                  type: 'subMenu',
                  subMenu: this.modificationsMenuItems(),
                },
                ...this.colorSchemeSubMenuItems(),
              ],
            },
            {
              label: 'Filter by...',
              icon: FilterListIcon,
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  FilterByTagDialog,
                  { model: self, handleClose },
                ])
              },
            },
            {
              type: 'subMenu',
              label: 'Pileup settings',
              subMenu: self.PileupDisplay.trackMenuItems(),
            },
            {
              type: 'subMenu',
              label: 'SNPCoverage settings',
              subMenu: self.SNPCoverageDisplay.trackMenuItems(),
            },
            {
              type: 'subMenu',
              label: 'Replace lower panel with...',
              subMenu: extra,
            },
          ]
        },
      }
    })
    .preProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      // @ts-expect-error
      const { height, ...rest } = snap
      return { heightPreConfig: height, ...rest }
    })
}

export default stateModelFactory

export type LinearAlignmentsDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearAlignmentsDisplayModel =
  Instance<LinearAlignmentsDisplayStateModel>
