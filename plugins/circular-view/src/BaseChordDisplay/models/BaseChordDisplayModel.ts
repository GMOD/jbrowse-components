import { getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import CircularChordRendererType from '@jbrowse/core/pluggableElementTypes/renderers/CircularChordRendererType'
import RendererType from '@jbrowse/core/pluggableElementTypes/renderers/RendererType'
import {
  getContainingView,
  getSession,
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
import renderReactionFactory from './renderReaction'
import { CircularViewModel } from '../../CircularView'

export const BaseChordDisplayModel = types
  .compose(
    'BaseChordDisplay',
    BaseDisplay,
    types.model({
      bezierRadiusRatio: 0.1,
      assemblyName: types.maybe(types.string),
    }),
  )
  .volatile(() => {
    return {
      // NOTE: all this volatile stuff has to be filled in at once
      // so that it stays consistent
      filled: false,
      html: '',
      data: undefined,
      message: '',
      error: undefined as Error | undefined,
      renderingComponent: undefined as undefined | AnyReactComponentType,
      refNameMap: undefined as Record<string, string> | undefined,
    }
  })
  .actions(self => {
    const { pluginManager } = getSession(self)
    return {
      onChordClick(feature: Feature) {
        getConf(self, 'onChordClick', [feature, self, pluginManager])
      },
    }
  })
  .views(self => ({
    get blockDefinitions() {
      const origSlices = (getContainingView(self) as CircularViewModel)
        .staticSlices
      if (!self.refNameMap) return origSlices

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

    get renderProps() {
      const view = getContainingView(self) as CircularViewModel
      return {
        ...getParentRenderProps(self),
        displayModel: self,
        bezierRadius: view.radiusPx * self.bezierRadiusRatio,
        radius: view.radiusPx,
        blockDefinitions: this.blockDefinitions,
        onChordClick: self.onChordClick,
      }
    },

    /**
     * the pluggable element type object for this diplay's
     * renderer
     */
    get rendererType() {
      const display = self
      const { pluginManager } = getSession(self)
      const ThisRendererType = pluginManager.getRendererType(
        self.rendererTypeName,
      )
      if (!ThisRendererType)
        throw new Error(`renderer "${display.rendererTypeName}" not found`)
      if (!ThisRendererType.ReactComponent)
        throw new Error(
          `renderer ${display.rendererTypeName} has no ReactComponent, it may not be completely implemented yet`,
        )
      return ThisRendererType
    },

    isCompatibleWithRenderer(renderer: RendererType) {
      return !!(renderer instanceof CircularChordRendererType)
    },

    /**
     * returns a string feature ID if the globally-selected object
     * is probably a feature
     */
    get selectedFeatureId() {
      if (!isAlive(self)) return undefined
      const session = getSession(self)
      if (!session) return undefined
      const { selection } = session
      // does it quack like a feature?
      if (isFeature(selection)) {
        return selection.id()
      }
      return undefined
    },
  }))
  .actions(self => ({
    renderStarted() {
      self.filled = false
      self.message = ''
      self.html = ''
      self.data = undefined
      self.error = undefined
      self.renderingComponent = undefined
    },
    renderSuccess({
      message,
      data,
      html,
      renderingComponent,
    }: {
      message: string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: any
      html: string
      renderingComponent: AnyReactComponentType
    }) {
      if (message) {
        self.filled = false
        self.message = message
        self.html = ''
        self.data = undefined
        self.error = undefined
        self.renderingComponent = undefined
      } else {
        self.filled = true
        self.message = ''
        self.html = html
        self.data = data
        self.error = undefined
        self.renderingComponent = renderingComponent
      }
    },
    renderError(error: Error) {
      console.error(error)
      // the rendering failed for some reason
      self.filled = false
      self.message = ''
      self.html = ''
      self.data = undefined
      self.error = error
      self.renderingComponent = undefined
    },

    setRefNameMap(refNameMap: Record<string, string>) {
      self.refNameMap = refNameMap
    },
    setError(error: Error) {
      self.error = error
    },
  }))
  .actions(self => {
    const { pluginManager } = getSession(self)
    const {
      renderReactionData,
      renderReactionEffect,
    } = pluginManager.jbrequire(renderReactionFactory)
    return {
      afterAttach() {
        makeAbortableReaction(
          self,
          renderReactionData,
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
            adapter: getConf(getParent(self, 2), 'adapter'),
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
    }
  })
