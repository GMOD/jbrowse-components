import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { types } from '@jbrowse/mobx-state-tree'

import { renderSvg } from './renderSvg.tsx'

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
           */
          featPositions: [] as DotplotFeatPos[],
          /**
           * #volatile
           * alpha transparency value for synteny drawing (0-1)
           */
          alpha: 1,
          /**
           * #volatile
           * minimum alignment length to display (in bp)
           */
          minAlignmentLength: 0,
          /**
           * #volatile
           * width of drawn lines in CSS pixels
           */
          lineWidth: 2,
          /**
           * #volatile
           * bpPerPx at which featPositions were computed (h-axis)
           */
          featPositionsBpPerPxH: 0,
          /**
           * #volatile
           * bpPerPx at which featPositions were computed (v-axis)
           */
          featPositionsBpPerPxV: 0,
          /**
           * #volatile
           * bumped after each geometry upload to the shared view renderer,
           * so the view-level draw autorun re-fires after fresh data is ready
           */
          geometryVersion: 0,
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
      setFeatPositions(
        positions: DotplotFeatPos[],
        bpPerPxH: number,
        bpPerPxV: number,
      ) {
        self.featPositions = positions
        self.featPositionsBpPerPxH = bpPerPxH
        self.featPositionsBpPerPxV = bpPerPxV
      },
      bumpGeometryVersion() {
        self.geometryVersion++
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
