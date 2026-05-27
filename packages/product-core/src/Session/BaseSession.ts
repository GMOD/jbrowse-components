import { ElementId } from '@jbrowse/core/util/types/mst'
import { getParent, isStateTreeNode, types } from '@jbrowse/mobx-state-tree'

import type { BaseRootModelType } from '../RootModel/BaseRootModel.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { DialogComponentType } from '@jbrowse/core/util'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

type DoneCallback = (
  doneCallback: () => void,
) => [DialogComponentType, Record<string, unknown>]

/**
 * #stateModel BaseSessionModel
 *
 * base session shared by all JBrowse products. Be careful what you include
 * here, everything will use it.
 */
export function BaseSessionModel<
  ROOT_MODEL_TYPE extends BaseRootModelType,
  JB_CONFIG_SCHEMA extends AnyConfigurationSchemaType,
>(_pluginManager: PluginManager) {
  return types
    .model({
      /**
       * #property
       */
      id: ElementId,
      /**
       * #property
       */
      name: types.string,
      /**
       * #property
       */
      margin: 0,
      /**
       * #property
       * used to keep track of which view is in focus
       */
      focusedViewId: types.maybe(types.string),
    })
    .volatile(() => ({
      /**
       * #volatile
       * this is the globally "selected" object. can be anything. code that
       * wants to deal with this should examine it to see what kind of thing it
       * is.
       */

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      selection: undefined as unknown,
      /**
       * #volatile
       * this is the globally "hovered" object. can be anything. code that
       * wants to deal with this should examine it to see what kind of thing it
       * is.
       */
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      hovered: undefined as unknown,
      /**
       * #volatile
       */
      queueOfDialogs: [] as [DialogComponentType, Record<string, unknown>][],
    }))
    .views(self => ({
      /**
       * #getter
       */
      get root() {
        return getParent<ROOT_MODEL_TYPE>(self)
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get jbrowse() {
        return self.root.jbrowse
      },
      /**
       * #getter
       */
      get rpcManager() {
        return self.root.rpcManager
      },
      /**
       * #getter
       */
      get configuration(): Instance<JB_CONFIG_SCHEMA> {
        return this.jbrowse.configuration
      },
      /**
       * #getter
       */
      get adminMode() {
        return self.root.adminMode
      },

      /**
       * #getter
       */
      get textSearchManager() {
        return self.root.textSearchManager
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get assemblies(): Instance<BaseAssemblyConfigSchema>[] {
        return self.jbrowse.assemblies
      },
      /**
       * #getter
       */
      get DialogComponent() {
        return self.queueOfDialogs[0]?.[0]
      },
      /**
       * #getter
       */
      get DialogProps() {
        return self.queueOfDialogs[0]?.[1]
      },
    }))
    .actions(self => ({
      /**
       * #action
       * set the global selection, i.e. the globally-selected object. can be a
       * feature, a view, just about anything
       */
      setSelection(thing: unknown) {
        self.selection = thing
      },

      /**
       * #action
       * clears the global selection
       */
      clearSelection() {
        self.selection = undefined
      },
      /**
       * #action
       */
      setHovered(thing: unknown) {
        self.hovered = thing
      },
      /**
       * #action
       */
      setName(str: string) {
        self.name = str
      },
      /**
       * #action
       */
      setFocusedViewId(viewId: string) {
        self.focusedViewId = viewId
      },
      /**
       * #action
       */
      removeActiveDialog() {
        self.queueOfDialogs = self.queueOfDialogs.slice(1)
      },
      /**
       * #action
       */
      queueDialog(doneCallback: DoneCallback) {
        const [component, props] = doneCallback(() => {
          this.removeActiveDialog()
        })
        self.queueOfDialogs = [...self.queueOfDialogs, [component, props]]
      },
    }))
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const { margin, ...rest } = snap
      return {
        ...rest,
        ...(margin ? { margin } : {}),
      } as typeof snap
    })
}

/** Session mixin MST type for the most basic session */
export type BaseSessionType = ReturnType<typeof BaseSessionModel>

/** Instance of the most basic possible session */
export type BaseSession = Instance<BaseSessionType>

/** Type guard for BaseSession */
export function isBaseSession(thing: IAnyStateTreeNode): thing is BaseSession {
  return 'id' in thing && 'name' in thing && 'root' in thing
}

/** Type guard for whether a thing is JBrowse session */
export function isSession(thing: unknown): thing is BaseSession {
  return isStateTreeNode(thing) && isBaseSession(thing)
}
