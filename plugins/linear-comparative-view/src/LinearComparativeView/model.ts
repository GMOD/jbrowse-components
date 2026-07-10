import { lazy } from 'react'

import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { buildAllTracksMenu } from '@jbrowse/core/ui'
import {
  avg,
  getEnv,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { addDisposer, cast, types } from '@jbrowse/mobx-state-tree'
import { installLinkedViewSync } from '@jbrowse/plugin-linear-genome-view'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import { autorun } from 'mobx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Instance, SnapshotIn } from '@jbrowse/mobx-state-tree'
import type {
  LinearGenomeViewModel,
  LinearGenomeViewStateModel,
} from '@jbrowse/plugin-linear-genome-view'
// lazies
const ReturnToImportFormDialog = lazy(
  () => import('@jbrowse/core/ui/ReturnToImportFormDialog'),
)

/**
 * #stateModel LinearComparativeView
 */
function stateModelFactory(pluginManager: PluginManager) {
  const LinearSyntenyViewHelper = pluginManager.getViewType(
    'LinearSyntenyViewHelper',
  ).stateModel
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
         * Abstract base: never registered or instantiated standalone, always
         * composed into a concrete subclass (e.g. LinearSyntenyView) that
         * overrides `type` with its own literal. Kept as `types.string` rather
         * than a literal so subclass models stay assignable to this base type.
         */
        type: types.string,
        /**
         * #property
         */
        trackSelectorType: types.stripDefault(types.string, 'hierarchical'),
        /**
         * #property
         */
        showIntraviewLinks: types.stripDefault(types.boolean, true),
        /**
         * #property
         */
        linkViews: types.stripDefault(types.boolean, false),
        /**
         * #property
         */
        levels: types.array(LinearSyntenyViewHelper),
        /**
         * #property
         * N genome rows, with N-1 synteny `levels` between adjacent pairs. The
         * views/levels invariant is maintained by reconcileLevels().
         */
        views: types.array(
          pluginManager.getViewType('LinearGenomeView')
            .stateModel as LinearGenomeViewStateModel,
        ),

        /**
         * #property
         * this represents tracks specific to this view specifically used for
         * read vs ref dotplots where this track would not really apply
         * elsewhere
         */
        viewTrackConfigs: types.stripDefault(
          types.array(pluginManager.pluggableConfigSchemaType('track')),
          [],
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
       * scroll-to-zoom is a global, personal preference resolved from the
       * session; toggling it in any view applies everywhere
       */
      get scrollZoom() {
        return getSession(self).scrollZoom
      },
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
      get assemblyNames() {
        return [...new Set(self.views.flatMap(v => v.assemblyNames))]
      },

      /**
       * #method
       */
      isViewCompact(idx: number) {
        return self.views[idx]?.scalebarOnly ?? false
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Reconcile the levels array to the views array: exactly one synteny
       * level per gap between adjacent views (N views -> N-1 levels). Grows or
       * shrinks from the end, preserving existing levels and their tracks. The
       * single source of truth for the views/levels invariant.
       */
      reconcileLevels() {
        while (self.levels.length < self.views.length - 1) {
          self.levels.push(cast({ level: self.levels.length }))
        }
        while (self.levels.length > Math.max(self.views.length - 1, 0)) {
          self.levels.pop()
        }
      },
    }))
    .actions(self => ({
      afterAttach() {
        // doesn't link showTrack/hideTrack, doesn't make sense in synteny
        // views most time
        installLinkedViewSync(self, ['horizontalScroll', 'zoomTo'])
        addDisposer(
          self,
          autorun(
            function comparativeViewWidthAutorun() {
              if (self.width) {
                for (const view of self.views) {
                  view.setWidth(self.width)
                }
              }
            },
            { name: 'ComparativeViewWidth' },
          ),
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
        self.levels = cast([])
        self.reconcileLevels()
      },

      /**
       * #action
       * Push a new genome row. The new trailing level starts with no synteny
       * tracks.
       */
      addView(view: SnapshotIn<LinearGenomeViewModel>) {
        self.views.push(view)
        self.reconcileLevels()
      },

      /**
       * #action
       * Drop the bottom genome row and its synteny level. Only terminal removal
       * is supported: a level's `level` index addresses views[level]/[level+1],
       * so removing a middle row would require reindexing every level below it.
       * Growth and shrinkage both happen at the end of the chain.
       */
      removeLastRow() {
        if (self.views.length > 0) {
          self.views.pop()
          self.reconcileLevels()
        }
      },

      /**
       * #action
       */
      setLinkViews(arg: boolean) {
        self.linkViews = arg
      },
      /**
       * #action
       */
      setScrollZoom(arg: boolean) {
        getSession(self).setScrollZoom?.(arg)
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
        return self.levels[level]?.toggleTrack(trackId)
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
            view.centerAt(center.coord0, center.refName, center.index)
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
      /**
       * #action
       */
      toggleCompactView(idx: number) {
        const view = self.views[idx]
        if (view) {
          view.setScalebarOnly(!view.scalebarOnly)
        }
      },
      /**
       * #action
       */
      compactAllViews() {
        for (const view of self.views) {
          view.setScalebarOnly(true)
        }
      },
      /**
       * #action
       */
      expandAllViews() {
        for (const view of self.views) {
          view.setScalebarOnly(false)
        }
      },
      /**
       * #action
       */
      autoScaleLevelHeights() {
        const numLevels = self.levels.length
        if (numLevels <= 0) {
          return
        }
        const targetHeight = Math.max(40, Math.min(100, 400 / numLevels))
        for (const level of self.levels) {
          level.setHeight(targetHeight)
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Append an assembly to the bottom of the stack and optionally show a
       * synteny track on the new level connecting it to the previous bottom
       * row. A synteny dataset is an edge between two adjacent assemblies, so
       * rows are only ever added at the chain's end.
       *
       * The new row is created with a LinearGenomeView `init` — its own
       * afterAttach autorun loads the assembly regions and navigates (whole
       * genome, or `loc` when given), so we don't reimplement that imperatively
       * here.
       */
      appendRow({
        assembly,
        loc,
        syntenyTrackId,
      }: {
        assembly: string
        loc?: string
        syntenyTrackId?: string
      }) {
        const level = self.views.length - 1
        self.addView({
          type: 'LinearGenomeView',
          hideHeader: true,
          init: { assembly, loc },
        })
        if (syntenyTrackId) {
          self.showTrack(syntenyTrackId, level)
        }
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
      /**
       * #method
       * items for the "Show..." submenu in the header. overridden by
       * subclasses to add view-specific toggle options
       */
      showMenuItems(): MenuItem[] {
        return []
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      menuItems(): MenuItem[] {
        const allTracks = self.views.flatMap(v => v.tracks)
        return [
          ...buildAllTracksMenu(getEnv(self).pluginManager, allTracks),
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
    .preProcessSnapshot<
      // legacy snapshots stored `tracks` at the top level before the `levels`
      // restructure; accept the loose shape and let MST revalidate at runtime
      | ({ tracks?: unknown; levels?: unknown } & Record<string, unknown>)
      | undefined
    >(snap => {
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
