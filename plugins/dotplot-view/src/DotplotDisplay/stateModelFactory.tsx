import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { types } from '@jbrowse/mobx-state-tree'

import { renderSvg } from './renderSvg.tsx'

import type { DotplotGeometryData } from './dotplotBackendTypes.ts'
import type { DotplotFeatPos } from './types.ts'
import type { ExportSvgOptions } from '../DotplotView/model.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ThemeOptions } from '@mui/material'

/**
 * #stateModel DotplotDisplay
 * #category display
 */
export function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'DotplotDisplay',
      BaseDisplay,
      types
        .model({
          /**
           * #property
           */
          type: types.literal('DotplotDisplay'),
          /**
           * #property
           */
          configuration: ConfigurationReference(configSchema),
          /**
           * #property
           * color by setting that overrides the config setting
           */
          colorBy: types.optional(types.string, 'default'),
        })
        .volatile(() => ({
          /**
           * #volatile
           */
          features: undefined as Feature[] | undefined,
          /**
           * #volatile
           * RPC-computed feature positions in pixel coords, with the
           * bpPerPx the conversion was performed at. One bundle so the
           * geometry recompute reads them atomically.
           */
          featPositions: undefined as
            | {
                positions: DotplotFeatPos[]
                bpPerPxH: number
                bpPerPxV: number
              }
            | undefined,
          /**
           * #volatile
           */
          alpha: 1,
          /**
           * #volatile
           */
          minAlignmentLength: 0,
          /**
           * #volatile
           */
          lineWidth: 2,
          /**
           * #volatile
           * GPU-instance geometry produced from featPositions, self-
           * describing via embedded bpPerPx. The containing DotplotView
           * aggregates one of these per display and uploads them to the
           * shared backend keyed by track index.
           */
          geometry: undefined as DotplotGeometryData | undefined,
          fetchStopToken: undefined as StopToken | undefined,
        })),
    )
    .views(self => ({
      get isLoading() {
        return self.fetchStopToken !== undefined && !self.features
      },
      get isRefetching() {
        return self.fetchStopToken !== undefined && !!self.features
      },
      /**
       * #getter
       */
      get rendererTypeName() {
        return getConf(self, ['renderer', 'type'])
      },
      /**
       * #method
       */
      renderProps() {
        return {
          ...getParentRenderProps(self),
          rpcDriverName: self.rpcDriverName,
          config: self.configuration.renderer,
        }
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      renderSvg(_opts: ExportSvgOptions & { theme?: ThemeOptions }) {
        return renderSvg(self)
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setLoading(stopToken?: StopToken) {
        self.fetchStopToken = stopToken
        self.error = undefined
      },
      /**
       * #action
       */
      setFeatures(args?: { features: Feature[] }) {
        if (!args) {
          return
        }
        self.features = args.features
        self.fetchStopToken = undefined
        self.error = undefined
      },
      /**
       * #action
       */
      setFeatPositions(arg: {
        positions: DotplotFeatPos[]
        bpPerPxH: number
        bpPerPxV: number
      }) {
        self.featPositions = arg
      },
      setGeometry(data: DotplotGeometryData | undefined) {
        self.geometry = data
      },
      /**
       * #action
       */
      setError(error: unknown) {
        console.error(error)
        self.error = error
        self.fetchStopToken = undefined
      },
      /**
       * #action
       */
      setAlpha(value: number) {
        self.alpha = value
      },
      /**
       * #action
       */
      setMinAlignmentLength(value: number) {
        self.minAlignmentLength = value
      },
      /**
       * #action
       */
      setLineWidth(value: number) {
        self.lineWidth = value
      },
      /**
       * #action
       */
      setColorBy(value: string) {
        self.colorBy = value
      },
    }))
    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { doAfterAttach } = await import('./afterAttach.ts')
            doAfterAttach(self)
          } catch (e) {
            console.error(e)
            self.setError(e)
          }
        })()
      },
    }))
}

export type DotplotDisplayStateModel = ReturnType<typeof stateModelFactory>
export type DotplotDisplayModel = Instance<DotplotDisplayStateModel>
