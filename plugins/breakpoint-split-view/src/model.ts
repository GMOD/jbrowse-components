import CompositeMap from '@jbrowse/core/util/compositeMap'
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
import { Feature } from '@jbrowse/core/util'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'

// https://stackoverflow.com/a/49186706/2129219 the array-intersection package
// on npm has a large kb size, and we are just intersecting open track ids so
// simple is better
function intersect<T>(a1: T[] = [], a2: T[] = [], ...rest: T[][]): T[] {
  const a12 = a1.filter(value => a2.includes(value))
  return rest.length === 0 ? a12 : intersect(a12, ...rest)
}

export const VIEW_DIVIDER_HEIGHT = 3

export interface Breakend {
  MateDirection: string
  Join: string
  Replacement: string
  MatePosition: string
}

export type LayoutRecord = [number, number, number, number]

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
    }))
    .views(self => ({
      // Find all track ids that match across multiple views
      get matchedTracks(): string[] {
        return intersect(
          ...self.views.map(view =>
            view.tracks.map(
              (t: { configuration: AnyConfigurationModel }) =>
                t.configuration.trackId as string,
            ),
          ),
        )
      },

      get matchedTrackFeatures() {
        return Object.fromEntries(
          this.matchedTracks.map(id => [
            id,
            new CompositeMap<string, Feature>(
              this.getMatchedTracks(id)?.map(t => t.displays[0].features) || [],
            ),
          ]),
        )
      },

      menuItems() {
        self.views
          .map((view, idx) => [idx, view.menuItems?.()])
          .filter(f => !!f[1])
          .map(f => ({ label: `View ${f[0]} Menu`, subMenu: f[1] }))
      },

      get viewDividerHeight() {
        return VIEW_DIVIDER_HEIGHT
      },

      // Get tracks with a given trackId across multiple views
      getMatchedTracks(trackConfigId: string) {
        return self.views
          .map(view => view.getTrack(trackConfigId))
          .filter(f => !!f)
      },

      // Paired reads are handled slightly differently than split reads
      hasPairedReads(trackConfigId: string) {
        return this.getTrackFeatures(trackConfigId).find(
          f => f.get('flags') & 64,
        )
      },

      // Translocation features are handled differently
      // since they do not have a mate e.g. they are one sided
      hasTranslocations(trackConfigId: string) {
        return this.getTrackFeatures(trackConfigId).find(
          f => f.get('type') === 'translocation',
        )
      },

      // Get a composite map of featureId->feature map for a track across
      // multiple views
      getTrackFeatures(trackConfigId: string) {
        return this.matchedTrackFeatures[trackConfigId]
      },

      getMatchedFeaturesInLayout(trackConfigId: string, features: Feature[][]) {
        // use reverse to search the second track first
        const tracks = this.getMatchedTracks(trackConfigId)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const calc = (track: any, feat: Feature) => {
          return track.displays[0].searchFeatureByID(feat.id())
        }

        return features.map(c =>
          c.map(feature => {
            const level = tracks.findIndex(track => calc(track, feature))
            const layout = calc(tracks[level], feature)
            return {
              feature,
              layout,
              level,
            }
          }),
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
        getParent(self, 2).removeView(self)
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
    }))

  const stateModel = types.compose(BaseViewModel, model)

  return { stateModel }
}

export type BreakpointView = ReturnType<typeof stateModelFactory>
export type BreakpointViewStateModel = BreakpointView['stateModel']
export type BreakpointViewModel = Instance<BreakpointViewStateModel>
