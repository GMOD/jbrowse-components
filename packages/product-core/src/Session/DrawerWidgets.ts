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

import { isBaseSession } from './BaseSession'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

const minDrawerWidth = 128

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
        () => localStorageGetItem('drawerPosition') || 'right',
      ),
      /**
       * #property
       */
      drawerWidth: types.optional(
        types.refinement(types.integer, width => width >= minDrawerWidth),
        384,
      ),
      /**
       * #property
       */
      widgets: types.map(widgetStateModelType),
      /**
       * #property
       */
      activeWidgets: types.map(types.safeReference(widgetStateModelType)),

      /**
       * #property
       */
      minimized: types.optional(types.boolean, false),
    })
    .views(self => ({
      /**
       * #getter
       */
      get visibleWidget() {
        if (isAlive(self)) {
          // returns most recently added item in active widgets
          return [...self.activeWidgets.values()][self.activeWidgets.size - 1]
        }
        return undefined
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setDrawerPosition(arg: string) {
        self.drawerPosition = arg
        localStorage.setItem('drawerPosition', arg)
      },

      /**
       * #action
       */
      updateDrawerWidth(drawerWidth: number) {
        if (drawerWidth === self.drawerWidth) {
          return self.drawerWidth
        }
        let newDrawerWidth = drawerWidth
        if (newDrawerWidth < minDrawerWidth) {
          newDrawerWidth = minDrawerWidth
        }
        self.drawerWidth = newDrawerWidth
        return newDrawerWidth
      },

      /**
       * #action
       */
      resizeDrawer(distance: number) {
        if (self.drawerPosition === 'left') {
          distance *= -1
        }
        const oldDrawerWidth = self.drawerWidth
        const newDrawerWidth = this.updateDrawerWidth(oldDrawerWidth - distance)
        return oldDrawerWidth - newDrawerWidth
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
        const typeDefinition = pluginManager.getElementType('widget', typeName)
        if (!typeDefinition) {
          throw new Error(`unknown widget type ${typeName}`)
        }
        const data = {
          ...initialState,
          id,
          type: typeName,
          configuration: conf || { type: typeName },
        }
        self.widgets.set(id, data)
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
      hasWidget(widget: WidgetStateModel) {
        return self.activeWidgets.has(widget.id)
      },

      /**
       * #action
       */
      hideWidget(widget: WidgetStateModel) {
        self.activeWidgets.delete(widget.id)
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
       */
      hideAllWidgets() {
        self.activeWidgets.clear()
      },

      /**
       * #action
       * opens a configuration editor to configure the given thing,
       * and sets the current task to be configuring it
       * @param configuration - can be an MST model or a frozen/plain object with trackId
       */
      editConfiguration(
        configuration: AnyConfigurationModel | { trackId: string },
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
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const {
        drawerPosition,
        drawerWidth,
        widgets,
        activeWidgets,
        minimized,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(drawerPosition !== 'right' ? { drawerPosition } : {}),
        ...(drawerWidth !== 384 ? { drawerWidth } : {}),
        ...(Object.keys(widgets).length ? { widgets } : {}),
        ...(Object.keys(activeWidgets).length ? { activeWidgets } : {}),
        ...(minimized ? { minimized } : {}),
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
