import React from 'react'
import { getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import CircularChordRendererType from '@jbrowse/core/pluggableElementTypes/renderers/CircularChordRendererType'
import RendererType from '@jbrowse/core/pluggableElementTypes/renderers/RendererType'
import {
  getContainingView,
  getSession,
  getEnv,
  makeAbortableReaction,
  AnyReactComponentType,
} from '@jbrowse/core/util'
import { Feature, isFeature } from '@jbrowse/core/util/simpleFeature'
import {
  getParentRenderProps,
  getRpcSessionId,
  getTrackAssemblyNames,
} from '@jbrowse/core/util/tracks'
import { Region } from '@jbrowse/core/util/types'
import { getParent, isAlive, types } from 'mobx-state-tree'

// locals
import { renderReactionData, renderReactionEffect } from './renderReaction'
import { CircularViewModel } from '../../CircularView/models/CircularView'

/**
 * #stateModel BaseChordDisplay
 * extends `BaseDisplay`
 */
function stateModelFactory() {
  return types
    .compose(
      'BaseChordDisplay',
      BaseDisplay,
      types.model({
        /**
         * #property
         */
        bezierRadiusRatio: 0.1,
        /**
         * #property
         */
        assemblyName: types.maybe(types.string),
      }),
    )
    .volatile(() => {
      return {
        // NOTE: all this volatile stuff has to be filled in at once
        // so that it stays consistent
        filled: false,
        reactElement: undefined as React.ReactElement | undefined,
        data: undefined,
        message: '',
        renderingComponent: undefined as undefined | AnyReactComponentType,
        refNameMap: undefined as Record<string, string> | undefined,
      }
    })
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
        const origSlices = (getContainingView(self) as CircularViewModel)
          .staticSlices
        if (!self.refNameMap) {
          return origSlices
        }

        const slices = JSON.parse(JSON.stringify(origSlices))

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        slices.forEach((slice: any) => {
          const regions = slice.region.elided
            ? slice.region.regions
            : [slice.region]
          regions.forEach((region: Region) => {
            const renamed = self.refNameMap?.[region.refName]
            if (renamed && region.refName !== renamed) {
              region.refName = renamed
            }
          })
        })
        return slices
      },

      /**
       * #method
       */
      renderProps() {
        const view = getContainingView(self) as CircularViewModel
        return {
          ...getParentRenderProps(self),
          rpcDriverName: self.rpcDriverName,
          displayModel: self,
          bezierRadius: view.radiusPx * self.bezierRadiusRatio,
          radius: view.radiusPx,
          blockDefinitions: this.blockDefinitions,
          onChordClick: self.onChordClick,
        }
      },

      /**
       * #getter
       * the pluggable element type object for this diplay's
       * renderer
       */
      get rendererType() {
        const display = self
        const { pluginManager } = getEnv(self)
        const ThisRendererType = pluginManager.getRendererType(
          self.rendererTypeName,
        )
        if (!ThisRendererType) {
          throw new Error(`renderer "${display.rendererTypeName}" not found`)
        }
        if (!ThisRendererType.ReactComponent) {
          throw new Error(
            `renderer ${display.rendererTypeName} has no ReactComponent, it may not be completely implemented yet`,
          )
        }
        return ThisRendererType
      },

      /**
       * #method
       */
      isCompatibleWithRenderer(renderer: RendererType) {
        return !!(renderer instanceof CircularChordRendererType)
      },

      /**
       * #getter
       * returns a string feature ID if the globally-selected object
       * is probably a feature
       */
      get selectedFeatureId() {
        if (!isAlive(self)) {
          return undefined
        }
        const session = getSession(self)
        if (!session) {
          return undefined
        }
        const { selection } = session
        // does it quack like a feature?
        if (isFeature(selection)) {
          return selection.id()
        }
        return undefined
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      renderStarted() {
        self.filled = false
        self.message = ''
        self.reactElement = undefined
        self.data = undefined
        self.error = undefined
        self.renderingComponent = undefined
      },
      /**
       * #action
       */
      renderSuccess({
        message,
        data,
        reactElement,
        renderingComponent,
      }: {
        message: string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: any
        reactElement: React.ReactElement
        renderingComponent: AnyReactComponentType
      }) {
        if (message) {
          self.filled = false
          self.message = message
          self.reactElement = undefined
          self.data = undefined
          self.error = undefined
          self.renderingComponent = undefined
        } else {
          self.filled = true
          self.message = ''
          self.reactElement = reactElement
          self.data = data
          self.error = undefined
          self.renderingComponent = renderingComponent
        }
      },
      /**
       * #action
       */
      renderError(error: unknown) {
        console.error(error)
        // the rendering failed for some reason
        self.filled = false
        self.message = ''
        self.reactElement = undefined
        self.data = undefined
        self.error = error
        self.renderingComponent = undefined
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

          // @ts-ignore
          renderReactionEffect,
          {
            name: `${self.type} ${self.id} rendering`,
            // delay: self.renderDelay || 300,
            fireImmediately: true,
          },
          self.renderStarted,
          self.renderSuccess,
          self.renderError,
        )
        makeAbortableReaction(
          self,
          () => ({
            assemblyNames: getTrackAssemblyNames(self.parentTrack) as string[],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            adapter: getConf(getParent<any>(self, 2), 'adapter'),
            assemblyManager: getSession(self).assemblyManager,
          }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          async ({ assemblyNames, adapter, assemblyManager }: any, signal) => {
            return assemblyManager.getRefNameMapForAdapter(
              adapter,
              assemblyNames[0],
              { signal, sessionId: getRpcSessionId(self) },
            )
          },
          {
            name: `${self.type} ${self.id} getting refNames`,
            fireImmediately: true,
          },
          () => {},
          refNameMap => {
            self.setRefNameMap(refNameMap)
          },
          error => {
            console.error(error)
            self.setError(error)
          },
        )
      },
    }))
}

export const BaseChordDisplayModel = stateModelFactory()
