import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  getContainingView,
  getEnv,
  getSession,
  isAbortException,
  isFeature,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import {
  getRpcSessionId,
  getTrackAssemblyNames,
} from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type {
  CircularViewModel,
  ExportSvgOptions,
} from '../../CircularView/model.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type SimpleFeature from '@jbrowse/core/util/simpleFeature'
import type { StopToken } from '@jbrowse/core/util/stopToken'
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
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      features: undefined as Map<string, Feature> | undefined,
      /**
       * #volatile
       */
      refNameMap: undefined as Record<string, string> | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get ready() {
        return self.features !== undefined
      },

      /**
       * #getter
       */
      get blockDefinitions() {
        const view = getContainingView(self) as CircularViewModel
        const origSlices = view.staticSlices ?? []
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
      get selectedFeatureId() {
        if (!isAlive(self)) {
          return undefined
        }
        const { selection } = getSession(self)
        return isFeature(selection) ? selection.id() : undefined
      },
    }))
    .actions(self => {
      const { pluginManager } = getEnv(self)
      return {
        /**
         * #action
         */
        onChordClick(feature: Feature) {
          getConf(self, 'onChordClick', { feature, track: self, pluginManager })
        },

        /**
         * #action
         */
        setFeatures(features: Map<string, Feature>) {
          self.features = features
          self.error = undefined
        },

        /**
         * #action
         */
        setRefNameMap(refNameMap: Record<string, string>) {
          self.refNameMap = refNameMap
        },
      }
    })
    .actions(self => {
      let renderStopToken: StopToken | undefined
      let refNameStopToken: StopToken | undefined

      return {
        afterAttach() {
          addDisposer(
            self,
            autorun(async () => {
              const view = getContainingView(self) as CircularViewModel
              if (!view.displayedRegions.length) {
                return
              }

              const sessionId = getRpcSessionId(self)
              const adapterConfig = structuredClone(self.adapterConfig)
              const regions = structuredClone(view.displayedRegions)
              const { rpcManager } = getSession(view)

              if (renderStopToken) {
                stopStopToken(renderStopToken)
              }
              const stopToken = createStopToken()
              renderStopToken = stopToken

              self.features = undefined
              self.error = undefined

              try {
                const feats = (await rpcManager.call(
                  sessionId,
                  'CoreGetFeatures',
                  { adapterConfig, regions, stopToken },
                )) as SimpleFeature[]
                if (isAlive(self) && renderStopToken === stopToken) {
                  self.setFeatures(new Map(feats.map(f => [f.id(), f])))
                }
              } catch (e) {
                if (
                  !isAbortException(e) &&
                  isAlive(self) &&
                  renderStopToken === stopToken
                ) {
                  console.error(e)
                  self.setError(e)
                }
              }
            }),
          )

          addDisposer(
            self,
            autorun(async () => {
              const assemblyNames = getTrackAssemblyNames(self.parentTrack)
              const adapter = getConf(self.parentTrack, 'adapter')
              const { assemblyManager } = getSession(self)
              const sessionId = getRpcSessionId(self)

              if (refNameStopToken) {
                stopStopToken(refNameStopToken)
              }
              const stopToken = createStopToken()
              refNameStopToken = stopToken

              try {
                const refNameMap =
                  await assemblyManager.getRefNameMapForAdapter(
                    adapter,
                    assemblyNames[0],
                    { stopToken, sessionId },
                  )
                if (
                  isAlive(self) &&
                  refNameStopToken === stopToken &&
                  refNameMap
                ) {
                  self.setRefNameMap(refNameMap)
                }
              } catch (e) {
                if (!isAbortException(e) && isAlive(self)) {
                  console.error(e)
                  self.setError(e)
                }
              }
            }),
          )
        },
      }
    })
    .views(self => ({
      /**
       * #method
       */
      async renderSvg(_opts: ExportSvgOptions & { theme?: ThemeOptions }) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self)
      },
    }))
}

export default stateModelFactory
