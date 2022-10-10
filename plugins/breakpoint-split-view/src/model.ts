import {
  LinearGenomeViewModel,
  LinearGenomeViewStateModel,
} from '@jbrowse/plugin-linear-genome-view'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  types,
  getParent,
  onAction,
  addDisposer,
  getPath,
  Instance,
} from 'mobx-state-tree'
import { BaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { getSession, Feature } from '@jbrowse/core/util'
import { AnyConfigurationModel, getConf } from '@jbrowse/core/configuration'
import { autorun } from 'mobx'

// https://stackoverflow.com/a/49186706/2129219 the array-intersection package
// on npm has a large kb size, and we are just intersecting open track ids so
// simple is better
function intersect<T>(
  cb: (l: T) => string,
  a1: T[] = [],
  a2: T[] = [],
  ...rest: T[][]
): T[] {
  const ids = a2.map(elt => cb(elt))
  const a12 = a1.filter(value => ids.includes(cb(value)))
  return rest.length === 0 ? a12 : intersect(cb, a12, ...rest)
}

export interface Breakend {
  MateDirection: string
  Join: string
  Replacement: string
  MatePosition: string
}

export type LayoutRecord = [number, number, number, number]

async function getBlockFeatures(
  model: BreakpointViewModel,
  track: { configuration: AnyConfigurationModel },
) {
  const { views } = model
  const { rpcManager, assemblyManager } = getSession(model)
  const assemblyName = model.views[0].assemblyNames[0]
  const assembly = await assemblyManager.waitForAssembly(assemblyName)
  if (!assembly) {
    return undefined // throw new Error(`assembly not found: "${assemblyName}"`)
  }
  const sessionId = track.configuration.trackId
  return Promise.all(
    views.map(async view =>
      (
        (await rpcManager.call(sessionId, 'CoreGetFeatures', {
          adapterConfig: getConf(track, ['adapter']),
          sessionId,
          regions: view.staticBlocks.contentBlocks,
        })) as Feature[][]
      ).flat(),
    ),
  )
}

export default function stateModelFactory(pluginManager: PluginManager) {
  const minHeight = 40
  const defaultHeight = 400
  const model = types
    .model('BreakpointSplitView', {
      type: types.literal('BreakpointSplitView'),
      height: types.optional(
        types.refinement(
          'viewHeight',
          types.number,
          (n: number) => n >= minHeight,
        ),
        defaultHeight,
      ),
      trackSelectorType: 'hierarchical',
      showIntraviewLinks: true,
      linkViews: false,
      interactToggled: false,
      views: types.array(
        pluginManager.getViewType('LinearGenomeView')
          .stateModel as LinearGenomeViewStateModel,
      ),
    })
    .volatile(() => ({
      width: 800,
      matchedTrackFeatures: {} as { [key: string]: Feature[][] },
    }))
    .views(self => ({
      // Find all track ids that match across multiple views
      get matchedTracks() {
        return intersect(
          elt => elt.configuration.trackId as string,
          ...self.views.map(view => view.tracks),
        )
      },

      menuItems() {
        self.views
          .map((view, idx) => [idx, view.menuItems?.()])
          .filter(f => !!f[1])
          .map(f => ({ label: `View ${f[0]} Menu`, subMenu: f[1] }))
      },

      // Get tracks with a given trackId across multiple views
      getMatchedTracks(trackConfigId: string) {
        return self.views
          .map(view => view.getTrack(trackConfigId))
          .filter(f => !!f)
      },

      // Translocation features are handled differently
      // since they do not have a mate e.g. they are one sided
      hasTranslocations(trackConfigId: string) {
        return [...this.getTrackFeatures(trackConfigId).values()].find(
          f => f.get('type') === 'translocation',
        )
      },

      // Get a composite map of featureId->feature map for a track across
      // multiple views
      getTrackFeatures(trackConfigId: string) {
        return new Map(
          self.matchedTrackFeatures[trackConfigId]
            ?.flat()
            .map(f => [f.id(), f]),
        )
      },

      getMatchedFeaturesInLayout(trackConfigId: string, features: Feature[][]) {
        // use reverse to search the second track first
        const tracks = this.getMatchedTracks(trackConfigId)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const calc = (track: any, feat: Feature) => {
          return track.displays[0].searchFeatureByID(feat.id())
        }

        return features.map(c =>
          c
            .map(feature => {
              const level = tracks.findIndex(track => calc(track, feature))
              if (level !== -1) {
                const layout = calc(tracks[level], feature)
                return {
                  feature,
                  layout,
                  level,
                }
              }
              return undefined
            })
            .filter(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (f): f is { feature: Feature; layout: any; level: number } => !!f,
            ),
        )
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          onAction(
            self,
            ({
              name,
              path,
              args,
            }: {
              name: string
              path?: string
              args?: unknown[]
            }) => {
              if (self.linkViews) {
                const actions = [
                  'horizontalScroll',
                  'zoomTo',
                  'setScaleFactor',
                  'showTrack',
                  'toggleTrack',
                  'hideTrack',
                  'setTrackLabels',
                  'toggleCenterLine',
                ]
                if (actions.includes(name) && path) {
                  this.onSubviewAction(name, path, args)
                }
              }
            },
          ),
        )
      },

      onSubviewAction(actionName: string, path: string, args?: unknown[]) {
        self.views.forEach(view => {
          const ret = getPath(view)
          if (ret.lastIndexOf(path) !== ret.length - path.length) {
            // @ts-ignore
            view[actionName](args?.[0])
          }
        })
      },

      setWidth(newWidth: number) {
        self.width = newWidth
        self.views.forEach(v => v.setWidth(newWidth))
      },

      removeView(view: LinearGenomeViewModel) {
        self.views.remove(view)
      },

      closeView() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getParent<any>(self, 2).removeView(self)
      },

      toggleInteract() {
        self.interactToggled = !self.interactToggled
      },
      toggleIntraviewLinks() {
        self.showIntraviewLinks = !self.showIntraviewLinks
      },
      toggleLinkViews() {
        self.linkViews = !self.linkViews
      },
      setMatchedTrackFeatures(obj: { [key: string]: Feature[][] }) {
        self.matchedTrackFeatures = obj
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(async () => {
            try {
              if (!self.views.every(view => view.initialized)) {
                return
              }
              self.setMatchedTrackFeatures(
                Object.fromEntries(
                  await Promise.all(
                    self.matchedTracks.map(async track => [
                      track.configuration.trackId,
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      await getBlockFeatures(self as any, track),
                    ]),
                  ),
                ),
              )
            } catch (e) {
              console.error(e)
              getSession(self).notify(`${e}`, 'error')
            }
          }),
        )
      },
    }))

  const stateModel = types.compose(BaseViewModel, model)

  return { stateModel }
}

export type BreakpointView = ReturnType<typeof stateModelFactory>
export type BreakpointViewStateModel = BreakpointView['stateModel']
export type BreakpointViewModel = Instance<BreakpointViewStateModel>
