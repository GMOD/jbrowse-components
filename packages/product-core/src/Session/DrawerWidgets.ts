import { isConfigurationModel } from '@jbrowse/core/configuration'
import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import {
  addDisposer,
  getEnv,
  isAlive,
  isStateTreeNode,
  types,
} from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { isBaseSession } from './BaseSession.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

const minDrawerWidth = 128
const minMainWidth = 150

/**
 * #stateModel DrawerWidgetSessionMixin
 */
export function DrawerWidgetSessionMixin(pluginManager: PluginManager) {
  const widgetStateModelType = pluginManager.pluggableMstType(
    'widget',
    'stateModel',
  )
  type WidgetStateModel = Instance<typeof widgetStateModelType>
  return types
    .model({
      /**
       * #property
       */
      drawerPosition: types.optional(
        types.string,
        () => localStorageGetItem('drawerPosition') ?? 'right',
      ),
      /**
       * #property
       */
      drawerWidth: types.stripDefault(
        types.refinement(types.integer, width => width >= minDrawerWidth),
        384,
      ),
      /**
       * #property
       */
      widgets: types.stripDefault(types.map(widgetStateModelType), {}),
      /**
       * #property
       */
      activeWidgets: types.stripDefault(
        types.map(types.safeReference(widgetStateModelType)),
        {},
      ),

      /**
       * #property
       */
      minimized: types.stripDefault(types.boolean, false),
    })
    .views(self => ({
      /**
       * #getter
       */
      get visibleWidget() {
        if (isAlive(self)) {
          // returns most recently added item in active widgets
          return [...self.activeWidgets.values()].at(-1)
        }
        return undefined
      },
    }))
    .volatile(() => ({
      /**
       * #volatile
       * true while the visible widget is shown in a modal dialog instead of the
       * drawer. Volatile because a restored session that opened straight into a
       * modal, with no drawer behind it, is disorienting
       */
      poppedOut: false,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setDrawerPosition(arg: string) {
        self.drawerPosition = arg
      },

      /**
       * #action
       */
      updateDrawerWidth(drawerWidth: number) {
        const max = window.innerWidth - minMainWidth
        self.drawerWidth = Math.min(Math.max(drawerWidth, minDrawerWidth), max)
        return self.drawerWidth
      },

      /**
       * #action
       */
      resizeDrawer(distance: number) {
        if (self.drawerPosition === 'left') {
          distance *= -1
        }
        const oldDrawerWidth = self.drawerWidth
        const max = window.innerWidth - minMainWidth
        self.drawerWidth = Math.min(
          Math.max(oldDrawerWidth - distance, minDrawerWidth),
          max,
        )
        return oldDrawerWidth - self.drawerWidth
      },

      /**
       * #action
       */
      addWidget(
        typeName: string,
        id: string,
        initialState = {},
        conf?: unknown,
      ) {
        self.widgets.set(id, {
          ...initialState,
          id,
          type: typeName,
          configuration: conf ?? { type: typeName },
        })
        return self.widgets.get(id)
      },

      /**
       * #action
       */
      showWidget(widget: WidgetStateModel) {
        if (self.activeWidgets.has(widget.id)) {
          self.activeWidgets.delete(widget.id)
        }
        self.activeWidgets.set(widget.id, widget)
        self.minimized = false
      },

      /**
       * #action
       */
      hideWidget(widget: WidgetStateModel) {
        self.activeWidgets.delete(widget.id)
        if (self.activeWidgets.size === 0) {
          self.poppedOut = false
        }
      },

      /**
       * #action
       */
      minimizeWidgetDrawer() {
        self.minimized = true
      },
      /**
       * #action
       */
      showWidgetDrawer() {
        self.minimized = false
      },
      /**
       * #action
       * show the visible widget in a modal dialog, freeing the drawer column
       */
      popoutWidget() {
        self.poppedOut = true
      },
      /**
       * #action
       */
      returnWidgetToDrawer() {
        self.poppedOut = false
      },
      /**
       * #action
       */
      hideAllWidgets() {
        self.activeWidgets.clear()
        self.poppedOut = false
      },

      /**
       * #action
       * opens a configuration editor to configure the given thing,
       * and sets the current task to be configuring it
       * @param configuration - can be an MST model or a frozen/plain object with trackId
       */
      editConfiguration(
        configuration: AnyConfigurationModel | { trackId: string },
        opts?: { expandedDisplayId?: string },
      ) {
        let targetConfig: AnyConfigurationModel

        if (
          isStateTreeNode(configuration) &&
          isConfigurationModel(configuration)
        ) {
          // Already an MST model (e.g., from track.configuration), use directly
          targetConfig = configuration
        } else if ('trackId' in configuration) {
          // Frozen/plain object - create a temporary MST model for editing
          const trackSchema = pluginManager.pluggableConfigSchemaType('track')
          targetConfig = trackSchema.create(configuration, getEnv(self))
        } else {
          throw new Error(
            'must pass a configuration model or frozen config with trackId to editConfiguration',
          )
        }

        const editor = this.addWidget(
          'ConfigurationEditorWidget',
          'configEditor',
          {},
        )
        // Set target via action since it's now volatile
        editor.setTarget(targetConfig)
        editor.setExpandedDisplayId(opts?.expandedDisplayId)
        this.showWidget(editor)
      },

      afterAttach() {
        addDisposer(
          self,
          autorun(
            function drawerPositionAutorun() {
              localStorageSetItem('drawerPosition', self.drawerPosition)
            },
            { name: 'DrawerPosition' },
          ),
        )
      },
    }))
    .postProcessSnapshot(snap => {
      // drawerPosition is a personal per-browser layout preference, not shared
      // view state: destructure it out so it never lands in the snapshot. It
      // stays localStorage-backed, so each browser keeps its own value.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const { drawerPosition, ...rest } = snap
      return {
        ...rest,
      } as typeof snap
    })
}

/** Session mixin MST type for a session that manages drawer widgets */
export type SessionWithDrawerWidgetsType = ReturnType<
  typeof DrawerWidgetSessionMixin
>

/** Instance of a session that manages drawer widgets */
export type SessionWithDrawerWidgets = Instance<SessionWithDrawerWidgetsType>

/** Type guard for SessionWithDrawerWidgets */
export function isSessionWithDrawerWidgets(
  session: IAnyStateTreeNode,
): session is SessionWithDrawerWidgets {
  return (
    isBaseSession(session) &&
    'widgets' in session &&
    'drawerPosition' in session
  )
}
