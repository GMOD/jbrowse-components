/* eslint-disable @typescript-eslint/no-explicit-any,import/no-extraneous-dependencies */
import {
  types,
  cast,
  Instance,
  getParent,
  addDisposer,
  isAlive,
  getSnapshot,
} from 'mobx-state-tree'
import jsonStableStringify from 'json-stable-stringify'
import {
  getSession,
  checkAbortSignal,
  isAbortException,
} from '@gmod/jbrowse-core/util'
import {
  readConfObject,
  getConf,
  ConfigurationReference,
  ConfigurationSchema,
} from '@gmod/jbrowse-core/configuration'
import { reaction } from 'mobx'

import {
  configSchemaFactory as baseConfigFactory,
  stateModelFactory as baseModelFactory,
} from '../LinearComparativeTrack'
import LinearSyntenyTrackComponent from './components/LinearSyntenyTrack'
import ServerSideRenderedBlockContent from './components/ServerSideRenderedBlockContent'

interface Block {
  start: number
  end: number
  refName: string
  assemblyName: string
  key: string
}

export function configSchemaFactory(pluginManager: any) {
  return ConfigurationSchema(
    'LinearSyntenyTrack',
    {
      viewType: 'LinearSyntenyView',
      // trackIds: {
      //   type: 'stringArray',
      //   defaultValue: [],
      // },
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
    },
    {
      baseConfiguration: baseConfigFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}

export function stateModelFactory(pluginManager: any, configSchema: any) {
  return types
    .compose(
      'LinearSyntenyTrack',
      baseModelFactory(pluginManager, configSchema),
      types
        .model('LinearSyntenyTrack', {
          type: types.literal('LinearSyntenyTrack'),
          configuration: ConfigurationReference(configSchema),
        })
        .volatile(self => ({
          // avoid circular typescript reference by casting to generic functional component
          renderInProgress: undefined as AbortController | undefined,
          filled: false,
          data: undefined as any,
          html: '',
          error: undefined as Error | undefined,
          message: undefined as string | undefined,
          renderingComponent: undefined as any,
          ReactComponent: (LinearSyntenyTrackComponent as unknown) as React.FC,
          ReactComponent2: (ServerSideRenderedBlockContent as unknown) as React.FC,
        })),
    )

    .views(self => ({
      // get subtracks(): any[] {
      //   const subtracks: any[] = []
      //   const parentView = getParent(self, 2)
      //   parentView.views.forEach((subview: any) => {
      //     subview.tracks.forEach((subviewTrack: any) => {
      //       const subtrackId = getConf(subviewTrack, 'trackId')
      //       if (this.trackIds.includes(subtrackId)) {
      //         subtracks.push(subviewTrack)
      //       }
      //     })
      //   })
      //   return subtracks
      // },

      // get subtrackFeatures() {
      //   return new CompositeMap<string, Feature>(
      //     this.subtracks.map(t => t.features),
      //   )
      // },
      //
      get renderProps() {
        const config = getConf(self, 'renderer')
        return {
          trackModel: self,
          config,
          height: 100,
          width: 100,
        }
      },
      get rendererTypeName() {
        return self.configuration.renderer.type
      },
      get adapterConfig() {
        // TODO possibly enriches with the adapters from associated trackIds
        return {
          name: self.configuration.adapter.type,
          assemblyNames: ['peach', 'grape'],
          ...getConf(self, 'adapter'),
        }
      },

      get trackIds() {
        return getConf(self, 'trackIds') as string[]
      },
    }))
    .actions(self => {
      let renderInProgress: undefined | AbortController
      return {
        afterAttach() {
          addDisposer(
            self,
            reaction(
              () => renderBlockData(cast(self)),
              data => renderBlockEffect(cast(self), data),
              {
                name: `{track.id} rendering`,
                delay: 100,
                fireImmediately: true,
              },
            ),
          )
        },

        setLoading(abortController: AbortController) {
          if (renderInProgress !== undefined) {
            if (!renderInProgress.signal.aborted) {
              renderInProgress.abort()
            }
          }
          self.filled = false
          self.message = undefined
          self.html = ''
          self.data = undefined
          self.error = undefined
          self.renderingComponent = undefined
          renderInProgress = abortController
        },
        setMessage(messageText: string) {
          if (renderInProgress && !renderInProgress.signal.aborted) {
            renderInProgress.abort()
          }
          self.filled = false
          self.message = messageText
          self.html = ''
          self.data = undefined
          self.error = undefined
          self.renderingComponent = undefined
          renderInProgress = undefined
        },
        setRendered(
          data: any,
          html: any,
          renderingComponent: React.Component,
          renderProps: any,
        ) {
          self.filled = true
          self.message = undefined
          self.html = html
          self.data = data
          self.error = undefined
          self.renderingComponent = renderingComponent
          renderInProgress = undefined
        },
        setError(error: Error) {
          console.error(error)
          if (renderInProgress && !renderInProgress.signal.aborted) {
            renderInProgress.abort()
          }
          // the rendering failed for some reason
          self.filled = false
          self.message = undefined
          self.html = ''
          self.data = undefined
          self.error = error
          self.renderingComponent = undefined
          renderInProgress = undefined
        },
        reload() {
          self.renderInProgress = undefined
          self.filled = false
          self.data = undefined
          self.html = ''
          self.error = undefined
          self.message = undefined
          self.ReactComponent = ServerSideRenderedBlockContent
          self.renderingComponent = undefined
          const data = renderBlockData(self as any)
          renderBlockEffect(cast(self), data)
        },
      }
    })
}

type SyntenyTrackModel = ReturnType<typeof stateModelFactory>
type SyntenyTrack = Instance<SyntenyTrackModel>

function renderBlockData(self: SyntenyTrack) {
  try {
    const { rpcManager } = getSession(self) as any
    const track = self

    const { renderProps, rendererType } = track
    const { config } = renderProps
    // This line is to trigger the mobx reaction when the config changes
    // It won't trigger the reaction if it doesn't think we're accessing it

    const sequenceConfig: { type?: string } = {}

    const { adapterConfig } = self
    const adapterConfigId = jsonStableStringify(adapterConfig)
    return {
      rendererType,
      rpcManager,
      renderProps,
      trackError: '', // track.error,
      renderArgs: {
        adapterType: self.adapterType.name,
        adapterConfig,
        sequenceAdapterType: sequenceConfig.type,
        sequenceAdapterConfig: sequenceConfig,
        rendererType: rendererType.name,
        views: getParent(self, 2).views.map((view: any) => {
          return {
            ...(getSnapshot(view) as any),
            regions: JSON.parse(
              JSON.stringify(view.dynamicBlocks.getRegions()),
            ),
          }
        }),
        width: 100,
        height: 100,
        renderProps,
        sessionId: adapterConfigId,
        timeout: 1000000, // 10000,
      },
    }
  } catch (error) {
    console.error(error)
    return {
      trackError: error,
    }
  }
}

async function renderBlockEffect(
  self: Instance<SyntenyTrack>,
  props: ReturnType<typeof renderBlockData>,
  allowRefetch = false,
) {
  const {
    trackError,
    rendererType,
    renderProps,
    rpcManager,
    renderArgs,
  } = props

  // note: cannotBeRenderedReason removed during hacking
  //
  //
  if (!isAlive(self)) {
    return
  }

  if (trackError) {
    self.setError(trackError)
    return
  }

  const aborter = new AbortController()
  self.setLoading(aborter)

  try {
    // @ts-ignore
    renderArgs.signal = aborter.signal
    // const callId = [
    //   assembleLocString(renderArgs.region),
    //   renderArgs.rendererType,
    // ]
    const { html, ...data } = await rendererType.renderInClient(
      rpcManager,
      renderArgs,
    )
    // if (aborter.signal.aborted) {
    //   console.log(...callId, 'request to abort render was ignored', html, data)
    // checkAbortSignal(aborter.signal)
    self.setRendered(data, html, rendererType.ReactComponent, renderProps)
  } catch (error) {
    if (isAbortException(error) && !aborter.signal.aborted) {
      // there is a bug in the underlying code and something is caching aborts. try to refetch once
      const track = getParent(self, 2)
      if (allowRefetch) {
        console.warn(`cached abort detected, refetching "${track.name}"`)
        renderBlockEffect(self, props, false)
        return
      }
      console.warn(`cached abort detected, failed to recover "${track.name}"`)
    }
    if (isAlive(self) && !isAbortException(error)) {
      console.error(error)
      // setting the aborted exception as an error will draw the "aborted" error, and we
      // have not found how to create a re-render if this occurs
      self.setError(error)
    }
  }
}

export type LinearSyntenyTrackStateModel = ReturnType<typeof stateModelFactory>
