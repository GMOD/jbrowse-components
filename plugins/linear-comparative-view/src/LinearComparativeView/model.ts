import { lazy } from 'react'

// jbrowse
import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { getSession, isSessionModelWithWidgets, avg } from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'

// icons
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import { autorun } from 'mobx'
import { addDisposer, cast, getPath, types } from 'mobx-state-tree'

// locals
import type { LinearSyntenyViewHelperStateModel } from '../LinearSyntenyViewHelper/stateModelFactory'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type {
  LinearGenomeViewModel,
  LinearGenomeViewStateModel,
} from '@jbrowse/plugin-linear-genome-view'
import type { Instance, SnapshotIn } from 'mobx-state-tree'

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
  const LinearSyntenyViewHelper = pluginManager.getViewType(
    'LinearSyntenyViewHelper',
  )?.stateModel as LinearSyntenyViewHelperStateModel
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
        interactToggled: false,
        /**
         * #property
         */
        levels: types.array(LinearSyntenyViewHelper),
        /**
         * #property
         * currently this is limited to an array of two
         */
        views: types.array(
          pluginManager.getViewType('LinearGenomeView')!
            .stateModel as LinearGenomeViewStateModel,
        ),

        /**
         * #property
         * this represents tracks specific to this view specifically used for
         * read vs ref dotplots where this track would not really apply
         * elsewhere
         */
        viewTrackConfigs: types.array(
          pluginManager.pluggableConfigSchemaType('track'),
        ),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      width: undefined as number | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get initialized() {
        return (
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
       */
      setLevelHeight(newHeight: number, level = 0) {
        const l = self.levels[level]!
        l.setHeight(newHeight)
        return l.height
      },

      /**
       * #action
       */
      activateTrackSelector(level: number) {
        if (self.trackSelectorType === 'hierarchical') {
          const session = getSession(self)
          if (isSessionModelWithWidgets(session)) {
            const selector = session.addWidget(
              'HierarchicalTrackSelectorWidget',
              'hierarchicalTrackSelector',
              {
                view: self.levels[level],
              },
            )
            session.showWidget(selector)
            return selector
          }
        }
        throw new Error(`invalid track selector type ${self.trackSelectorType}`)
      },

      /**
       * #action
       */
      toggleTrack(trackId: string, level = 0) {
        self.levels[level]?.toggleTrack(trackId)
      },
      /**
       * #action
       */
      showTrack(trackId: string, level = 0, initialSnapshot = {}) {
        if (!self.levels[level]) {
          self.levels[level] = cast({ level })
        }
        self.levels[level].showTrack(trackId, initialSnapshot)
      },

      /**
       * #action
       */
      hideTrack(trackId: string, level = 0) {
        self.levels[level]?.hideTrack(trackId)
      },
      /**
       * #action
       */
      squareView() {
        const average = avg(self.views.map(v => v.bpPerPx))
        for (const view of self.views) {
          const center = view.pxToBp(view.width / 2)
          view.setNewView(average, view.offsetPx)
          if (center.refName) {
            view.centerAt(center.coord, center.refName, center.index)
          }
        }
      },
      /**
       * #action
       */
      clearView() {
        self.views = cast([])
        self.levels = cast([])
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
          {
            label: 'Return to import form',
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                ReturnToImportFormDialog,
                {
                  model: self,
                  handleClose,
                },
              ])
            },
            icon: FolderOpenIcon,
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
              for (const view of self.views) {
                const { leftOffset, rightOffset } = view
                if (leftOffset && rightOffset) {
                  view.moveTo(leftOffset, rightOffset)
                }
              }
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
              for (const view of self.views) {
                view.setWidth(self.width)
              }
            }
          }),
        )
      },
    }))
    .preProcessSnapshot(snap => {
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const { tracks, levels = [{ tracks, level: 0 }], ...rest } = snap || {}
      return {
        ...rest,
        levels,
      }
    })
}

export type LinearComparativeViewStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearComparativeViewModel =
  Instance<LinearComparativeViewStateModel>

export default stateModelFactory
