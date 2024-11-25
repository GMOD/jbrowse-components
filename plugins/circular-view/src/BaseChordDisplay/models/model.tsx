import React from 'react'

// jbrowse
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  getContainingView,
  getSession,
  getEnv,
  isFeature,
  makeAbortableReaction,
  ReactRendering,
} from '@jbrowse/core/util'
import {
  getParentRenderProps,
  getRpcSessionId,
  getTrackAssemblyNames,
} from '@jbrowse/core/util/tracks'

// locals
import clone from 'clone'
import { getParent, isAlive, types } from 'mobx-state-tree'
import { baseChordDisplayConfig } from './configSchema'
import { renderReactionData, renderReactionEffect } from './renderReaction'
import type {
  CircularViewModel,
  ExportSvgOptions,
} from '../../CircularView/models/model'
import type { AnyReactComponentType, Feature } from '@jbrowse/core/util'
import type { ThemeOptions } from '@mui/material'

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
      bezierRadiusRatio: 0.1,
      /**
       * #property
       */
      assemblyName: types.maybe(types.string),
      /**
       * #property
       */
      configuration: ConfigurationReference(baseChordDisplayConfig),
    }),
  )
  .volatile(() => ({
    // NOTE: all this volatile stuff has to be filled in at once
    // so that it stays consistent
    /**
     * #volatile
     */
    filled: false,
    /**
     * #volatile
     */
    reactElement: undefined as React.ReactElement | undefined,
    /**
     * #volatile
     */
    data: undefined,
    /**
     * #volatile
     */
    html: undefined as string | undefined,
    /**
     * #volatile
     */
    message: '',
    /**
     * #volatile
     */
    renderingComponent: undefined as undefined | AnyReactComponentType,
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
    renderProps() {
      const view = getContainingView(self) as CircularViewModel
      return {
        ...getParentRenderProps(self),
        rpcDriverName: self.rpcDriverName,
        bezierRadius: view.radiusPx * self.bezierRadiusRatio,
        radius: view.radiusPx,
        blockDefinitions: this.blockDefinitions,
        onChordClick: self.onChordClick,
      }
    },

    /**
     * #getter
     * the pluggable element type object for this display's renderer
     */
    get rendererType() {
      return getEnv(self).pluginManager.getRendererType(self.rendererTypeName)
    },

    /**
     * #getter
     * returns a string feature ID if the globally-selected object is probably
     * a feature
     */
    get selectedFeatureId() {
      if (!isAlive(self)) {
        return undefined
      }
      const { selection } = getSession(self)
      return isFeature(selection) ? selection.id() : undefined
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
      message?: string
      data?: any
      html?: string
      reactElement?: React.ReactElement
      renderingComponent?: AnyReactComponentType
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
    async renderSvg(
      opts: ExportSvgOptions & {
        theme?: ThemeOptions
      },
    ) {
      const data = renderReactionData(self)
      const rendering = await renderReactionEffect({
        ...data,
        exportSVG: opts,
        theme: opts.theme || data.renderProps.theme,
      })
      return <ReactRendering rendering={rendering} />
    },
  }))
