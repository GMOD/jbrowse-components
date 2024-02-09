import { lazy } from 'react'
import {
  addDisposer,
  cast,
  getParent,
  getPath,
  getRoot,
  onAction,
  resolveIdentifier,
  types,
  Instance,
  SnapshotIn,
} from 'mobx-state-tree'
import { autorun, transaction } from 'mobx'

// jbrowse
import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { MenuItem } from '@jbrowse/core/ui'
import { getSession, isSessionModelWithWidgets, avg } from '@jbrowse/core/util'
import PluginManager from '@jbrowse/core/PluginManager'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { ElementId } from '@jbrowse/core/util/types/mst'
import {
  LinearGenomeViewModel,
  LinearGenomeViewStateModel,
} from '@jbrowse/plugin-linear-genome-view'

// icons
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import {
  hideTrackGeneric,
  showTrackGeneric,
  toggleTrackGeneric,
} from '@jbrowse/core/util/tracks'

// lazies
const ReturnToImportFormDialog = lazy(
  () => import('@jbrowse/core/ui/ReturnToImportFormDialog'),
)

/**
 * #stateModel LinearComparativeView
 * extends
 * - [BaseViewModel](../baseviewmodel)
 */
function stateModelFactory(pluginManager: PluginManager) {
  return types
    .compose(
      'LinearComparativeView',
      BaseViewModel,
      types.model({
        /**
         * #property
         */
        id: ElementId,
        /**
         * #property
         */
        type: types.literal('LinearComparativeView'),
        /**
         * #property
         */
        trackSelectorType: 'hierarchical',
        /**
         * #property
         */
        showIntraviewLinks: true,
        /**
         * #property
         */
        linkViews: false,
        /**
         * #property
         */
        interactToggled: false,
        /**
         * #property
         */
        middleComparativeHeight: 100,
        /**
         * #property
         */
        tracks: types.array(
          pluginManager.pluggableMstType('track', 'stateModel'),
        ),
        /**
         * #property
         * currently this is limited to an array of two
         */
        views: types.array(
          pluginManager.getViewType('LinearGenomeView')
            .stateModel as LinearGenomeViewStateModel,
        ),

        /**
         * #property
         * this represents tracks specific to this view specifically used
         * for read vs ref dotplots where this track would not really apply
         * elsewhere
         */
        viewTrackConfigs: types.array(
          pluginManager.pluggableConfigSchemaType('track'),
        ),
      }),
    )
    .volatile(() => ({
      width: undefined as number | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get highResolutionScaling() {
        return 2
      },
      /**
       * #getter
       */
      get initialized() {
        return (
          self.width !== undefined &&
          self.views.length > 0 &&
          self.views.every(view => view.initialized)
        )
      },

      /**
       * #getter
       */
      get refNames() {
        return self.views.map(v => [
          ...new Set(v.staticBlocks.map(m => m.refName)),
        ])
      },

      /**
       * #getter
       */
      get assemblyNames() {
        return [...new Set(self.views.flatMap(v => v.assemblyNames))]
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          onAction(self, param => {
            if (self.linkViews) {
              const { name, path, args } = param

              // doesn't link showTrack/hideTrack, doesn't make sense in
              // synteny views most time
              const actions = ['horizontalScroll', 'zoomTo', 'setScaleFactor']
              if (actions.includes(name) && path) {
                this.onSubviewAction(name, path, args)
              }
            }
          }),
        )
      },

      // automatically removes session assemblies associated with this view
      // e.g. read vs ref
      beforeDestroy() {
        const session = getSession(self)
        for (const name of self.assemblyNames) {
          session.removeTemporaryAssembly?.(name)
        }
      },

      onSubviewAction(actionName: string, path: string, args?: unknown[]) {
        self.views.forEach(view => {
          const ret = getPath(view)
          if (!ret.endsWith(path)) {
            // @ts-expect-error
            view[actionName](args?.[0])
          }
        })
      },

      /**
       * #action
       */
      setWidth(newWidth: number) {
        self.width = newWidth
      },

      /**
       * #action
       */
      setViews(views: SnapshotIn<LinearGenomeViewModel>[]) {
        self.views = cast(views)
      },

      /**
       * #action
       */
      removeView(view: LinearGenomeViewModel) {
        self.views.remove(view)
      },

      /**
       * #action
       * removes the view itself from the state tree entirely by calling the
       * parent removeView
       */
      closeView() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getParent<any>(self, 2).removeView(self)
      },

      /**
       * #action
       */
      setMiddleComparativeHeight(n: number) {
        self.middleComparativeHeight = n
        return self.middleComparativeHeight
      },

      /**
       * #action
       */
      toggleLinkViews() {
        self.linkViews = !self.linkViews
      },

      /**
       * #action
       */
      activateTrackSelector() {
        if (self.trackSelectorType === 'hierarchical') {
          const session = getSession(self)
          if (isSessionModelWithWidgets(session)) {
            const selector = session.addWidget(
              'HierarchicalTrackSelectorWidget',
              'hierarchicalTrackSelector',
              { view: self },
            )
            session.showWidget(selector)
            return selector
          }
          return undefined
        }
        throw new Error(`invalid track selector type ${self.trackSelectorType}`)
      },

      /**
       * #action
       */
      toggleTrack(trackId: string) {
        return toggleTrackGeneric(self, trackId)
      },

      /**
       * #action
       */
      showTrack(trackId: string, initialSnapshot = {}) {
        return showTrackGeneric(self, trackId, initialSnapshot)
      },

      /**
       * #action
       */
      hideTrack(trackId: string) {
        return hideTrackGeneric(self, trackId)
      },
      /**
       * #action
       */
      squareView() {
        const average = avg(self.views.map(v => v.bpPerPx))
        self.views.forEach(view => {
          const center = view.pxToBp(view.width / 2)
          view.setNewView(average, view.offsetPx)
          if (!center.refName) {
            return
          }
          view.centerAt(center.coord, center.refName, center.index)
        })
      },
      /**
       * #action
       */
      clearView() {
        self.views = cast([])
        self.tracks = cast([])
      },
    }))
    .views(() => ({
      /**
       * #method
       * includes a subset of view menu options because the full list is a
       * little overwhelming. overridden by subclasses
       */
      headerMenuItems(): MenuItem[] {
        return []
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      menuItems(): MenuItem[] {
        return [
          ...self.views
            .map((view, idx) => [idx, view.menuItems?.()] as const)
            .filter(f => !!f[1])
            .map(f => ({ label: `View ${f[0] + 1} Menu`, subMenu: f[1] })),
          {
            label: 'Return to import form',
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                ReturnToImportFormDialog,
                { model: self, handleClose },
              ])
            },
            icon: FolderOpenIcon,
          },
          {
            label: 'Open track selector',
            onClick: self.activateTrackSelector,
            icon: TrackSelectorIcon,
          },
        ]
      },
      /**
       * #method
       */
      rubberBandMenuItems() {
        return [
          {
            label: 'Zoom to region(s)',
            onClick: () => {
              self.views.forEach(view => {
                const { leftOffset, rightOffset } = view
                if (leftOffset && rightOffset) {
                  view.moveTo(leftOffset, rightOffset)
                }
              })
            },
          },
        ]
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            if (self.width) {
              self.views.forEach(v => v.setWidth(self.width))
            }
          }),
        )
      },
    }))
}

export type LinearComparativeViewStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearComparativeViewModel =
  Instance<LinearComparativeViewStateModel>

export default stateModelFactory
