import React from 'react'
import clone from 'clone'
import { getParent, isAlive, types } from 'mobx-state-tree'

// jbrowse
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import CircularChordRendererType from '@jbrowse/core/pluggableElementTypes/renderers/CircularChordRendererType'
import RendererType from '@jbrowse/core/pluggableElementTypes/renderers/RendererType'
import {
  getContainingView,
  getSession,
  getEnv,
  isFeature,
  makeAbortableReaction,
  AnyReactComponentType,
  Feature,
  ReactRendering,
} from '@jbrowse/core/util'
import {
  getParentRenderProps,
  getRpcSessionId,
  getTrackAssemblyNames,
} from '@jbrowse/core/util/tracks'

// locals
import { renderReactionData, renderReactionEffect } from './renderReaction'
import {
  CircularViewModel,
  ExportSvgOptions,
} from '../../CircularView/models/model'
import { ThemeOptions } from '@mui/material'
import { baseChordDisplayConfig } from './configSchema'

/**
 * #stateModel BaseChordDisplay
 * extends
 * - [BaseDisplay](../basedisplay)
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export const BaseChordDisplayModel = types
  .compose(
    'BaseChordDisplay',
    BaseDisplay,
    types.model({
      /**
       * #property
       */
      assemblyName: types.maybe(types.string),

      /**
       * #property
       */
      bezierRadiusRatio: 0.1,
      /**
       * #property
       */
      configuration: ConfigurationReference(baseChordDisplayConfig),
    }),
  )
  .volatile(() => ({
    data: undefined,
    // NOTE: all this volatile stuff has to be filled in at once
    // so that it stays consistent
    filled: false,
    html: undefined as string | undefined,
    message: '',
    reactElement: undefined as React.ReactElement | undefined,
    refNameMap: undefined as Record<string, string> | undefined,
    renderingComponent: undefined as undefined | AnyReactComponentType,
  }))
  .actions(self => {
    const { pluginManager } = getEnv(self)
    const track = self
    return {
      /**
       * #action
       */
      onChordClick(feature: Feature) {
        getConf(self, 'onChordClick', { feature, pluginManager, track })
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

      const slices = clone(origSlices)

      slices.forEach(slice => {
        const regions = slice.region.elided
          ? slice.region.regions
          : [slice.region]
        regions.forEach(region => {
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
    isCompatibleWithRenderer(renderer: RendererType) {
      return !!(renderer instanceof CircularChordRendererType)
    },

    /**
     * #method
     */
    renderProps() {
      const view = getContainingView(self) as CircularViewModel
      return {
        ...getParentRenderProps(self),
        bezierRadius: view.radiusPx * self.bezierRadiusRatio,
        blockDefinitions: this.blockDefinitions,
        displayModel: self,
        onChordClick: self.onChordClick,
        radius: view.radiusPx,
        rpcDriverName: self.rpcDriverName,
      }
    },

    /**
     * #getter
     * the pluggable element type object for this display's
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
    renderError(error: unknown) {
      console.error(error)
      // the rendering failed for some reason
      self.filled = false
      self.message = ''
      self.reactElement = undefined
      self.html = undefined
      self.data = undefined
      self.error = error
      self.renderingComponent = undefined
    },

    /**
     * #action
     */
    renderStarted() {
      self.filled = false
      self.message = ''
      self.reactElement = undefined
      self.data = undefined
      self.html = undefined
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
      html,
      renderingComponent,
    }: {
      message: string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: any
      html: string
      reactElement: React.ReactElement
      renderingComponent: AnyReactComponentType
    }) {
      if (message) {
        self.filled = false
        self.message = message
        self.reactElement = undefined
        self.data = undefined
        self.html = undefined
        self.error = undefined
        self.renderingComponent = undefined
      } else {
        self.filled = true
        self.message = ''
        self.reactElement = reactElement
        self.data = data
        self.html = html
        self.error = undefined
        self.renderingComponent = renderingComponent
      }
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

        // @ts-expect-error
        renderReactionEffect,
        {
          // delay: self.renderDelay || 300,
          fireImmediately: true,

          name: `${self.type} ${self.id} rendering`,
        },
        self.renderStarted,
        self.renderSuccess,
        self.renderError,
      )

      makeAbortableReaction(
        self,
        () => ({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          adapter: getConf(getParent<any>(self, 2), 'adapter'),

          assemblyManager: getSession(self).assemblyManager,
          assemblyNames: getTrackAssemblyNames(self.parentTrack),
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async ({ assemblyNames, adapter, assemblyManager }: any, signal) => {
          return assemblyManager.getRefNameMapForAdapter(
            adapter,
            assemblyNames[0],
            { sessionId: getRpcSessionId(self), signal },
          )
        },
        {
          fireImmediately: true,
          name: `${self.type} ${self.id} getting refNames`,
        },
        () => {},
        refNameMap => self.setRefNameMap(refNameMap),
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
    async renderSvg(
      opts: ExportSvgOptions & {
        theme: ThemeOptions
      },
    ) {
      const data = renderReactionData(self)
      const rendering = await renderReactionEffect(
        {
          ...data,
          exportSVG: opts,
          theme: opts.theme || data.renderProps.theme,
        },
        undefined,
        self,
      )
      return <ReactRendering rendering={rendering} />
    },
  }))
