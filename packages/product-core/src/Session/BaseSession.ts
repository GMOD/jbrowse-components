import { getConf } from '@jbrowse/core/configuration'
import SnackbarModel from '@jbrowse/core/ui/SnackbarModel'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { getParent, isStateTreeNode, types } from '@jbrowse/mobx-state-tree'

import type { BaseRootModelType } from '../RootModel/BaseRootModel.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigModel } from '@jbrowse/core/assemblyManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type {
  AnimationMode,
  DialogComponentType,
  TrackConfigChange,
} from '@jbrowse/core/util'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

type DoneCallback = (
  doneCallback: () => void,
) => [DialogComponentType, Record<string, unknown>]

function isAnimationMode(val: unknown): val is AnimationMode {
  return val === 'system' || val === 'enabled' || val === 'disabled'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

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
  const baseModel = types
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
      margin: types.stripDefault(types.number, 0),
      /**
       * #property
       * used to keep track of which view is in focus
       */
      focusedViewId: types.maybe(types.string),
      /**
       * #property
       * one session-wide toggle for all region highlight bands (URL/view
       * highlights and bookmark overlays)
       */
      highlightsVisible: types.stripDefault(types.boolean, true),
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
      /**
       * #volatile
       * runtime user-preference overrides keyed by preference id, resolved by
       * `getPreference` against the `configuration.preferences` admin defaults.
       * Empty here (config-only); products that let users edit preferences load
       * and persist these via localStorage. A runtime override map layered over
       * config defaults, kept off the snapshot since prefs are local UI.
       */
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      preferencesOverrides: {} as Record<string, unknown>,
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
      get assemblies(): BaseAssemblyConfigModel[] {
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
    .views(self => ({
      /**
       * #method
       * resolved value of a user preference: a runtime override if the user set
       * one, otherwise the admin/embedder `configuration.preferences` default.
       * The override map is empty unless the product loads it (web/desktop).
       */
      getPreference(key: string): unknown {
        const override = self.preferencesOverrides[key]
        return override === undefined
          ? getConf(self, ['preferences', key])
          : override
      },
      /**
       * #method
       * resolved value of a per-display-type slot default the user promoted
       * (see `setDisplayTypeDefault`); undefined when nothing was promoted.
       */
      getDisplayTypeDefault(displayType: string, slot: string): unknown {
        const all = self.preferencesOverrides.displayTypeDefaults
        const forType = isRecord(all) ? all[displayType] : undefined
        return isRecord(forType) ? forType[slot] : undefined
      },
      /**
       * #method
       * every runtime preference-override that currently differs from its
       * config/admin default, as `{ path, from, to }` rows — the exact set
       * `clearPreferenceOverrides` reverts. Backs the confirmation diff shown
       * before "Reset to defaults" (mirrors the per-track changes dialog). A
       * scalar pref (animationMode, scrollZoom) whose override equals the
       * default is omitted (reverting it is a no-op); each promoted
       * per-display-type default is always a difference from the un-promoted
       * state, so `from` reads "(default)".
       */
      getPreferenceChanges(): TrackConfigChange[] {
        const changes: TrackConfigChange[] = []
        for (const [key, value] of Object.entries(self.preferencesOverrides)) {
          if (key === 'displayTypeDefaults') {
            const byType = isRecord(value) ? value : {}
            for (const [displayType, slots] of Object.entries(byType)) {
              const slotMap = isRecord(slots) ? slots : {}
              for (const [slot, slotValue] of Object.entries(slotMap)) {
                changes.push({
                  path: ['displayTypeDefaults', displayType, slot],
                  from: undefined,
                  to: slotValue,
                } as TrackConfigChange)
              }
            }
          } else {
            const dflt = getConf(self, ['preferences', key])
            if (value !== dflt) {
              changes.push({
                path: [key],
                from: dflt,
                to: value,
              } as TrackConfigChange)
            }
          }
        }
        return changes
      },
    }))
    .views(self => ({
      /**
       * #getter
       * resolved feature-layout animation mode (never undefined)
       */
      get animationMode(): AnimationMode {
        const mode = self.getPreference('animationMode')
        return isAnimationMode(mode) ? mode : 'enabled'
      },
      /**
       * #getter
       * resolved scroll-to-zoom preference. Global and personal (never shared in
       * a session snapshot); every wheel-zoom view reads this single value.
       */
      get scrollZoom(): boolean {
        return self.getPreference('scrollZoom') === true
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
       * toggle all region highlight bands across every view
       */
      setHighlightsVisible(arg: boolean) {
        self.highlightsVisible = arg
      },
      /**
       * #action
       * set a runtime user-preference override (see `getPreference`). Mutates
       * volatile state; products persist these to localStorage.
       */
      setPreferenceOverride(key: string, value: unknown) {
        self.preferencesOverrides = {
          ...self.preferencesOverrides,
          [key]: value,
        }
      },
      /**
       * #action
       * clear every runtime preference override at once — scrollZoom,
       * animationMode, and every promoted per-display-type default (see
       * `setDisplayTypeDefault`) — so each falls back to its config/admin
       * default. Backs the Preferences dialog "Reset to defaults" button.
       */
      clearPreferenceOverrides() {
        self.preferencesOverrides = {}
      },
      /**
       * #action
       * clear a single runtime preference override (see `getPreference`) so it
       * falls back to its config/admin default. Backs the per-entry reset in the
       * Preferences dialog "Reset to defaults" confirmation.
       */
      clearPreferenceOverride(key: string) {
        const { [key]: _dropped, ...rest } = self.preferencesOverrides
        self.preferencesOverrides = rest
      },
      /**
       * #action
       * set the global scroll-to-zoom preference (see the `scrollZoom` getter)
       */
      setScrollZoom(flag: boolean) {
        self.preferencesOverrides = {
          ...self.preferencesOverrides,
          scrollZoom: flag,
        }
      },
      /**
       * #action
       * promote (or, with `value` undefined, clear) a per-display-type slot
       * default. Stored under `preferencesOverrides.displayTypeDefaults` so the
       * PreferencesSessionMixin persists it to localStorage like other prefs.
       */
      setDisplayTypeDefault(displayType: string, slot: string, value: unknown) {
        const all = self.preferencesOverrides.displayTypeDefaults
        const map: Record<string, unknown> = isRecord(all) ? { ...all } : {}
        const prev = map[displayType]
        const forType: Record<string, unknown> = isRecord(prev)
          ? { ...prev }
          : {}
        if (value === undefined) {
          delete forType[slot]
        } else {
          forType[slot] = value
        }
        // drop the whole display-type entry once its last slot is cleared, so
        // clearing leaves no empty `{ [displayType]: {} }` cruft accumulating in
        // the persisted localStorage blob
        if (Object.keys(forType).length) {
          map[displayType] = forType
        } else {
          delete map[displayType]
        }
        self.preferencesOverrides = {
          ...self.preferencesOverrides,
          displayTypeDefaults: map,
        }
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

  return types.compose(baseModel, SnackbarModel())
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
