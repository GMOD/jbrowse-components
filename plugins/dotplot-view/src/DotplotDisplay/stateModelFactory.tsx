import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  getContainingView,
  makeAbortableReaction,
} from '@jbrowse/core/util'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { types } from '@jbrowse/mobx-state-tree'

import { doAfterAttach } from './afterAttach.ts'
import { renderBlockData, renderBlockEffect } from './renderDotplotBlock.ts'

import type { DotplotWebGLRenderer } from './drawDotplotWebGL.ts'
import type { FeatPos } from './types.ts'
import type { DotplotViewModel } from '../DotplotView/model.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Instance } from '@jbrowse/mobx-state-tree'

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
           * alpha transparency value for rendering (0-1)
           */
          alpha: 1,
          /**
           * #volatile
           * minimum alignment length to display (in bp)
           */
          minAlignmentLength: 0,
          /**
           * #volatile
           * data loaded from adapter (used for WebGL rendering)
           */
          data: undefined as any,
          /**
           * #volatile
           * WebGL renderer instance
           */
          webglRenderer: null as DotplotWebGLRenderer | null,
          /**
           * #volatile
           * flag indicating if WebGL renderer is initialized
           */
          webglInitialized: false,
          /**
           * #volatile
           * computed feature positions for WebGL rendering
           */
          featPositions: [] as FeatPos[],
          /**
           * #volatile
           * currently mouseover'd feature ID
           */
          mouseoverId: undefined as string | undefined,
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
    .actions(self => ({
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
      /**
       * #action
       */
      setWebGLRenderer(renderer: DotplotWebGLRenderer | null) {
        self.webglRenderer = renderer
      },
      /**
       * #action
       */
      setWebGLInitialized(value: boolean) {
        self.webglInitialized = value
      },
      /**
       * #action
       */
      setFeatPositions(positions: FeatPos[]) {
        self.featPositions = positions
      },
      /**
       * #action
       */
      setMouseoverId(id?: string) {
        self.mouseoverId = id
      },
      /**
       * #action
       */
      setData(value: any) {
        self.data = value
        console.log('setData: data loaded, features.length=', value?.features?.length)
      },
      /**
       * #action
       */
      setLoading() {
        self.data = undefined
      },
      /**
       * #action
       */
      setRendered(args?: {
        data: any
      }) {
        if (args) {
          self.data = args.data
          console.log('setRendered: data set, data keys:', Object.keys(args.data || {}))
          console.log('setRendered: data=', args.data)
        }
      },
      /**
       * #action
       */
      setError(error: unknown) {
        console.error('Data loading error:', error)
        self.data = undefined
      },
      afterAttach() {
        console.log('afterAttach: setting up data loading and WebGL rendering')
        makeAbortableReaction(
          self,
          () => renderBlockData(self),
          blockData => {
            console.log('renderBlockEffect: loading data')
            return renderBlockEffect(blockData)
          },
          {
            name: `${self.type} ${self.id} rendering`,
            delay: 500,
            fireImmediately: true,
          },
          this.setLoading,
          this.setRendered,
          this.setError,
        )
        doAfterAttach(self)
      },
    }))
}

export type DotplotDisplayStateModel = ReturnType<typeof stateModelFactory>
export type DotplotDisplay = Instance<DotplotDisplayStateModel>
export type DotplotDisplayModel = Instance<DotplotDisplayStateModel>
