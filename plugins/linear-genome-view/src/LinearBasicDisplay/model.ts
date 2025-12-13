import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import {
  SimpleFeature,
  getContainingTrack,
  getSession,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import {
  cast,
  getEnv,
  getParent,
  isAlive,
  types,
} from '@jbrowse/mobx-state-tree'
import VisibilityIcon from '@mui/icons-material/Visibility'

import { BaseLinearDisplay } from '../BaseLinearDisplay'

import type {
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

const SetMaxHeightDialog = lazy(() => import('./components/SetMaxHeightDialog'))
const AddFiltersDialog = lazy(() => import('./components/AddFiltersDialog'))

/**
 * #stateModel LinearBasicDisplay
 * #category display
 * used by `FeatureTrack`, has simple settings like "show/hide feature labels",
 * etc.
 *
 * extends
 * - [BaseLinearDisplay](../baselineardisplay)
 */
function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearBasicDisplay',
      BaseLinearDisplay,
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearBasicDisplay'),
        /**
         * #property
         */
        trackShowLabels: types.maybe(types.boolean),
        /**
         * #property
         */
        trackShowDescriptions: types.maybe(types.boolean),
        /**
         * #property
         */
        trackDisplayMode: types.maybe(types.string),
        /**
         * #property
         */
        trackMaxHeight: types.maybe(types.number),
        /**
         * #property
         */
        trackSubfeatureLabels: types.maybe(types.string),
        /**
         * #property
         */
        trackGeneGlyphMode: types.maybe(types.string),
        /**
         * #property
         */
        trackDisplayDirectionalChevrons: types.maybe(types.boolean),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         */
        jexlFilters: types.maybe(types.array(types.string)),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       * Stores the feature under the mouse cursor, fetched asynchronously
       * via CoreGetFeatureDetails RPC to avoid serializing all features
       */
      featureUnderMouseVolatile: undefined as Feature | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get activeFilters() {
        // config jexlFilters are deferred evaluated so they are prepended with
        // jexl at runtime rather than being stored with jexl in the config
        return (
          self.jexlFilters ??
          getConf(self, 'jexlFilters').map((r: string) => `jexl:${r}`)
        )
      },
      /**
       * #getter
       */
      get rendererTypeName() {
        return getConf(self, ['renderer', 'type'])
      },

      /**
       * #getter
       */
      get sequenceAdapter() {
        const { assemblyManager } = getSession(self)
        const track = getParent<{ configuration: AnyConfigurationModel }>(
          self,
          2,
        )
        const assemblyNames = readConfObject(
          track.configuration,
          'assemblyNames',
        ) as string[]
        const assembly = assemblyManager.get(assemblyNames[0]!)
        return assembly ? getConf(assembly, ['sequence', 'adapter']) : undefined
      },

      /**
       * #getter
       */
      get showLabels() {
        return self.trackShowLabels ?? getConf(self, ['renderer', 'showLabels'])
      },

      /**
       * #getter
       */
      get showDescriptions() {
        return (
          self.trackShowDescriptions ??
          getConf(self, ['renderer', 'showDescriptions'])
        )
      },

      /**
       * #getter
       */
      get maxHeight() {
        return self.trackMaxHeight ?? getConf(self, ['renderer', 'maxHeight'])
      },

      /**
       * #getter
       */
      get displayMode() {
        return (
          self.trackDisplayMode ?? getConf(self, ['renderer', 'displayMode'])
        )
      },

      /**
       * #getter
       */
      get subfeatureLabels() {
        return (
          self.trackSubfeatureLabels ??
          getConf(self, ['renderer', 'subfeatureLabels'])
        )
      },

      /**
       * #getter
       */
      get geneGlyphMode() {
        return (
          self.trackGeneGlyphMode ??
          getConf(self, ['renderer', 'geneGlyphMode'])
        )
      },

      /**
       * #getter
       */
      get displayDirectionalChevrons() {
        return (
          self.trackDisplayDirectionalChevrons ??
          getConf(self, ['renderer', 'displayDirectionalChevrons'])
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get rendererConfig() {
        const configBlob = getConf(self, ['renderer']) || {}
        const config = configBlob as Omit<typeof configBlob, symbol>

        return self.rendererType.configSchema.create(
          {
            ...config,
            showLabels: self.showLabels,
            showDescriptions: self.showDescriptions,
            subfeatureLabels: self.subfeatureLabels,
            displayMode: self.displayMode,
            maxHeight: self.maxHeight,
            geneGlyphMode: self.geneGlyphMode,
            displayDirectionalChevrons: self.displayDirectionalChevrons,
          },
          getEnv(self),
        )
      },
    }))

    .actions(self => ({
      /**
       * #action
       */
      setJexlFilters(f?: string[]) {
        self.jexlFilters = cast(f)
      },
      /**
       * #action
       */
      setFeatureUnderMouse(feat?: Feature) {
        self.featureUnderMouseVolatile = feat
      },
      /**
       * #action
       */
      toggleShowLabels() {
        self.trackShowLabels = !self.showLabels
      },
      /**
       * #action
       */
      toggleShowDescriptions() {
        self.trackShowDescriptions = !self.showDescriptions
      },
      /**
       * #action
       */
      setSubfeatureLabels(val: string) {
        self.trackSubfeatureLabels = val
      },
      /**
       * #action
       */
      setDisplayMode(val: string) {
        self.trackDisplayMode = val
      },
      /**
       * #action
       */
      setMaxHeight(val?: number) {
        self.trackMaxHeight = val
      },
      /**
       * #action
       */
      setGeneGlyphMode(val: string) {
        self.trackGeneGlyphMode = val
      },
      /**
       * #action
       */
      toggleDisplayDirectionalChevrons() {
        self.trackDisplayDirectionalChevrons = !self.displayDirectionalChevrons
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Override featureUnderMouse to return the volatile feature
       * which is fetched asynchronously via CoreGetFeatureDetails
       */
      get featureUnderMouse() {
        return self.featureUnderMouseVolatile
      },
    }))
    .views(self => {
      const {
        trackMenuItems: superTrackMenuItems,
        renderProps: superRenderProps,
        renderingProps: superRenderingProps,
      } = self
      return {
        /**
         * #method
         */
        renderProps() {
          const superProps = superRenderProps()
          return {
            ...(superProps as Omit<typeof superProps, symbol>),
            config: self.rendererConfig,
            filters: new SerializableFilterChain({
              filters: self.activeFilters,
            }),
            sequenceAdapter: self.sequenceAdapter,
          }
        },

        /**
         * #method
         */
        renderingProps() {
          const superProps = superRenderingProps()
          const session = getSession(self)
          return {
            ...superProps,
            async onFeatureClick(_: unknown, featureId?: string) {
              const { rpcManager } = session
              try {
                const f = featureId || self.featureIdUnderMouse
                if (!f) {
                  self.clearFeatureSelection()
                } else {
                  const sessionId = getRpcSessionId(self)
                  const { feature } = (await rpcManager.call(
                    sessionId,
                    'CoreGetFeatureDetails',
                    {
                      featureId: f,
                      sessionId,
                      layoutId: getContainingTrack(self).id,
                      rendererType: self.rendererTypeName,
                    },
                  )) as { feature: SimpleFeatureSerialized | undefined }

                  if (isAlive(self) && feature) {
                    self.selectFeature(new SimpleFeature(feature))
                  }
                }
              } catch (e) {
                console.error(e)
                session.notifyError(`${e}`, e)
              }
            },
            async onFeatureContextMenu(_: unknown, featureId?: string) {
              const { rpcManager } = session
              try {
                const f = featureId || self.featureIdUnderMouse
                if (!f) {
                  self.clearFeatureSelection()
                } else {
                  const sessionId = getRpcSessionId(self)
                  const { feature } = (await rpcManager.call(
                    sessionId,
                    'CoreGetFeatureDetails',
                    {
                      featureId: f,
                      sessionId,
                      layoutId: getContainingTrack(self).id,
                      rendererType: self.rendererTypeName,
                    },
                  )) as { feature: SimpleFeatureSerialized | undefined }

                  if (isAlive(self) && feature) {
                    self.setContextMenuFeature(new SimpleFeature(feature))
                  }
                }
              } catch (e) {
                console.error(e)
                session.notifyError(`${e}`, e)
              }
            },
          }
        },

        /**
         * #method
         */
        trackMenuItems(): MenuItem[] {
          return [
            ...superTrackMenuItems(),
            {
              label: 'Show...',
              icon: VisibilityIcon,
              subMenu: [
                {
                  label: 'Show labels',
                  type: 'checkbox',
                  checked: self.showLabels,
                  onClick: () => {
                    self.toggleShowLabels()
                  },
                },
                {
                  label: 'Show descriptions',
                  type: 'checkbox',
                  checked: self.showDescriptions,
                  onClick: () => {
                    self.toggleShowDescriptions()
                  },
                },
                {
                  label: 'Show chevrons',
                  type: 'checkbox',
                  checked: self.displayDirectionalChevrons,
                  onClick: () => {
                    self.toggleDisplayDirectionalChevrons()
                  },
                },
                {
                  label: 'Subfeature labels',
                  subMenu: ['none', 'below', 'overlay'].map(val => ({
                    label: val,
                    type: 'radio' as const,
                    checked: self.subfeatureLabels === val,
                    onClick: () => {
                      self.setSubfeatureLabels(val)
                    },
                  })),
                },
                {
                  label: 'Gene glyph',
                  subMenu: [
                    {
                      value: 'all',
                      label: 'All transcripts',
                    },
                    {
                      value: 'longest',
                      label: 'Longest transcript',
                    },
                    {
                      value: 'longestCoding',
                      label: 'Longest coding transcript',
                    },
                  ].map(({ value, label }) => ({
                    label,
                    type: 'radio' as const,
                    checked: self.geneGlyphMode === value,
                    onClick: () => {
                      self.setGeneGlyphMode(value)
                    },
                  })),
                },
              ],
            },
            {
              label: 'Display mode',
              icon: VisibilityIcon,
              subMenu: [
                'normal',
                'compact',
                'reducedRepresentation',
                'collapse',
              ].map(val => ({
                label: val,
                type: 'radio' as const,
                checked: self.displayMode === val,
                onClick: () => {
                  self.setDisplayMode(val)
                },
              })),
            },
            {
              label: 'Set max height',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  SetMaxHeightDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
            {
              label: 'Filters',
              subMenu: [
                {
                  label: 'Show only genes',
                  type: 'checkbox',
                  checked: self.activeFilters.includes(
                    "jexl:get(feature,'type')=='gene'",
                  ),
                  onClick: () => {
                    const geneFilter = "jexl:get(feature,'type')=='gene'"
                    const currentFilters = self.activeFilters
                    if (currentFilters.includes(geneFilter)) {
                      self.setJexlFilters(
                        currentFilters.filter((f: string) => f !== geneFilter),
                      )
                    } else {
                      self.setJexlFilters([...currentFilters, geneFilter])
                    }
                  },
                },
                {
                  label: 'Edit filters...',
                  onClick: () => {
                    getSession(self).queueDialog(handleClose => [
                      AddFiltersDialog,
                      {
                        model: self,
                        handleClose,
                      },
                    ])
                  },
                },
              ],
            },
          ]
        },
      }
    })
}

export type FeatureTrackStateModel = ReturnType<typeof stateModelFactory>
export type FeatureTrackModel = Instance<FeatureTrackStateModel>

export default stateModelFactory
