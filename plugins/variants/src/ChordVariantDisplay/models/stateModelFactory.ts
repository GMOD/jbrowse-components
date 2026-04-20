import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  getContainingView,
  getEnv,
  getSession,
  isFeature,
  makeAbortableReaction,
} from '@jbrowse/core/util'
import {
  getParentRenderProps,
  getRpcSessionId,
  getTrackAssemblyNames,
} from '@jbrowse/core/util/tracks'
import { getParent, isAlive, types } from '@jbrowse/mobx-state-tree'

import { renderReactionData, renderReactionEffect } from './renderReaction.ts'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type {
  CircularViewModel,
  ExportSvgOptions,
} from '@jbrowse/plugin-circular-view'
import type { ThemeOptions } from '@mui/material'

/**
 * #stateModel ChordVariantDisplay
 * extends
 * - [BaseDisplay](../basedisplay)
 */
const stateModelFactory = (configSchema: AnyConfigurationSchemaType) => {
  return types
    .compose(
      'ChordVariantDisplay',
      BaseDisplay,
      types.model({
        /**
         * #property
         */
        type: types.literal('ChordVariantDisplay'),
        /**
         * #property
         */
        bezierRadiusRatio: 0.1,
        /**
         * #property
         */
        assemblyName: types.maybe(types.string),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      filled: false,
      /**
       * #volatile
       */
      features: undefined as Map<string, Feature> | undefined,
      /**
       * #volatile
       * block definitions captured at fetch time — zoom-independent
       */
      cachedSlices: undefined as
        | { bpPerRadian: number; startRadians: number; region: unknown; flipped: boolean }[]
        | undefined,
      /**
       * #volatile
       */
      message: '',
      /**
       * #volatile
       */
      refNameMap: undefined as Record<string, string> | undefined,
    }))
    .actions(self => {
      const { pluginManager } = getEnv(self)
      const track = self
      return {
        /**
         * #action
         */
        onChordClick(feature: Feature) {
          getConf(self, 'onChordClick', { feature, track, pluginManager })
        },
      }
    })
    .views(self => ({
      /**
       * #getter
       */
      get blockDefinitions() {
        const view = getContainingView(self) as CircularViewModel
        const origSlices = view.staticSlices
        if (!self.refNameMap) {
          return origSlices
        }

        const slices = structuredClone(origSlices)

        for (const slice of slices) {
          const regions = slice.region.elided
            ? slice.region.regions
            : [slice.region]
          for (const region of regions) {
            const renamed = self.refNameMap[region.refName]
            if (renamed && region.refName !== renamed) {
              region.refName = renamed
            }
          }
        }
        return slices
      },

      /**
       * #getter
       */
      get rendererTypeName() {
        return self.configuration.renderer.type
      },

      /**
       * #getter
       */
      get rendererType() {
        return getEnv(self).pluginManager.getRendererType(this.rendererTypeName)
      },

      /**
       * #getter
       */
      get selectedFeatureId() {
        if (!isAlive(self)) {
          return undefined
        }
        const { selection } = getSession(self)
        return isFeature(selection) ? selection.id() : undefined
      },

      /**
       * #method
       * zoom-independent render props — radius/bezierRadius/blockDefinitions are
       * read live from the view by the observer display component instead
       */
      renderProps() {
        return {
          ...getParentRenderProps(self),
          rpcDriverName: self.rpcDriverName,
          config: self.configuration.renderer,
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      renderStarted() {
        console.log('[chord renderStarted] display blanked')
        self.filled = false
        self.message = ''
        self.features = undefined
        self.cachedSlices = undefined
        self.error = undefined
      },
      /**
       * #action
       */
      renderSuccess({
        message,
        features,
        cachedSlices,
      }: {
        message?: string
        features?: Map<string, Feature>
        cachedSlices?: typeof self.cachedSlices
      }) {
        if (message) {
          self.filled = false
          self.message = message
          self.features = undefined
          self.cachedSlices = undefined
          self.error = undefined
        } else {
          self.filled = true
          self.message = ''
          self.features = features
          self.cachedSlices = cachedSlices
          self.error = undefined
        }
      },
      /**
       * #action
       */
      renderError(error: unknown) {
        console.error(error)
        self.filled = false
        self.message = ''
        self.features = undefined
        self.error = error
      },

      /**
       * #action
       */
      setRefNameMap(refNameMap: Record<string, string>) {
        self.refNameMap = refNameMap
      },
    }))
    .actions(self => ({
      afterAttach() {
        makeAbortableReaction(
          self,
          renderReactionData,
          renderReactionEffect,
          {
            name: `${self.type} ${self.id} rendering`,
            fireImmediately: true,
          },
          self.renderStarted,
          self.renderSuccess,
          self.renderError,
        )

        makeAbortableReaction(
          self,
          () => {
            return {
              assemblyNames: getTrackAssemblyNames(self.parentTrack),
              adapter: getConf(getParent<any>(self, 2), 'adapter'),
              assemblyManager: getSession(self).assemblyManager,
            } as const
          },
          async (args, stopToken) => {
            return args
              ? args.assemblyManager.getRefNameMapForAdapter(
                  args.adapter,
                  args.assemblyNames[0],
                  {
                    stopToken,
                    sessionId: getRpcSessionId(self),
                  },
                )
              : undefined
          },
          {
            name: `${self.type} ${self.id} getting refNames`,
            fireImmediately: true,
          },
          () => {},
          refNameMap => {
            if (refNameMap) {
              self.setRefNameMap(refNameMap)
            }
          },
          error => {
            console.error(error)
            self.setError(error)
          },
        )
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      async renderSvg(opts: ExportSvgOptions & { theme?: ThemeOptions }) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self, opts)
      },
    }))
}

export default stateModelFactory
