import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { ReactRendering, getContainingView } from '@jbrowse/core/util'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { types } from '@jbrowse/mobx-state-tree'

import { renderBlockData } from './renderDotplotBlock.ts'

import type { DotplotWebGPUProxy } from './DotplotWebGPUProxy.ts'
import type { DotplotFeatPos } from './types.ts'
import type {
  DotplotViewModel,
  ExportSvgOptions,
} from '../DotplotView/model.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
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
           */
          gpuRenderer: null as DotplotWebGPUProxy | null,
          /**
           * #volatile
           */
          gpuInitialized: false,
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
           * bpPerPx at which featPositions were computed (h-axis)
           */
          featPositionsBpPerPxH: 0,
          /**
           * #volatile
           * bpPerPx at which featPositions were computed (v-axis)
           */
          featPositionsBpPerPxV: 0,
        })),
    )
    .views(self => ({
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
      async renderSvg(opts: ExportSvgOptions & { theme?: ThemeOptions }) {
        const props = renderBlockData(self)
        if (!props) {
          return null
        }

        const { rendererType, rpcManager, renderProps, renderingProps } = props
        const rendering = await rendererType.renderInClient(rpcManager, {
          ...renderProps,
          renderingProps,
          exportSVG: opts,
          theme: opts.theme || renderProps.theme,
        })
        const { hview, vview } = getContainingView(self) as DotplotViewModel
        const offX = -hview.offsetPx + rendering.offsetX
        const offY = -vview.offsetPx + rendering.offsetY
        return (
          <g transform={`translate(${offX} ${-offY})`}>
            <ReactRendering rendering={rendering} />
          </g>
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setLoading(_stopToken?: string) {
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
      /**
       * #action
       */
      setGpuRenderer(renderer: DotplotWebGPUProxy | null) {
        self.gpuRenderer = renderer
      },
      /**
       * #action
       */
      setGpuInitialized(value: boolean) {
        self.gpuInitialized = value
      },
      /**
       * #action
       */
      setError(error: unknown) {
        console.error(error)
        self.error = error
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
