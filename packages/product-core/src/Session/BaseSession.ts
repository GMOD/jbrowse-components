import { getConf } from '@jbrowse/core/configuration'
import SnackbarModel from '@jbrowse/core/ui/SnackbarModel'
import { setNumberGrouping } from '@jbrowse/core/util'
import { freezeDeep } from '@jbrowse/core/util/freezeDeep'
import { isFeature, unwrapFeature } from '@jbrowse/core/util/simpleFeature'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { getParent, isStateTreeNode, types } from '@jbrowse/mobx-state-tree'
import { observable } from 'mobx'

import { applyDeveloperMode } from './developerMode.ts'

import type { BaseRootModelType } from '../RootModel/BaseRootModel.ts'
import type { HeldNode } from '../pruneUnbuildableNodes.ts'
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
       * used to keep track of which view is in focus
       */
      focusedViewId: types.maybe(types.string),
      /**
       * #property
       * one session-wide toggle for all region highlight bands (URL/view
       * highlights and bookmark overlays)
       */
      highlightsVisible: types.stripDefault(types.boolean, true),
      /**
       * #property
       * views, tracks, displays and widgets `pruneUnbuildableNodes` took out of
       * the tree because this build has no plugin for their type, each with the
       * anchor that puts it back. Opaque here on purpose — nothing in the
       * session reads it, and the shape belongs to that module.
       *
       * It is a **declared property** rather than data riding along in the
       * snapshot because MST silently drops an undeclared key: without this
       * line the held nodes survive the prune and then vanish the moment
       * `setSession` builds the tree, and every unit test of the prune still
       * passes. `heldNodesSurviveTheSession.test.ts` is the canary.
       */
      heldForMissingPlugins: types.stripDefault(
        types.frozen<HeldNode[] | undefined>(),
        undefined,
      ),
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
       *
       * An `observable.map` (not a plain object reassigned wholesale) so each
       * preference is its own tracked key: writing one (`setScrollZoom`) can't
       * invalidate a reader of another. A single spread-replaced object made
       * every setter wake every reader, so toggling scroll-to-zoom re-fetched
       * every track.
       *
       * `deep: false` keeps an object-valued preference a plain object rather
       * than a MobX Proxy, which V8's structured-clone serializer rejects. The
       * map still notifies per key on `set`, so shallow values lose no
       * reactivity — and nothing can mutate a preference in place, because
       * `setPreferenceOverride` freezes what it stores.
       */
      preferencesOverrides: observable.map<string, unknown>(undefined, {
        deep: false,
      }),
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
       * the admin/embedder `configuration.preferences` value for a key, ignoring
       * any runtime override — i.e. what a reset falls back to. Exposed rather
       * than inlined because "differs from the default" is a question the
       * Preferences reset diff asks about settings this map doesn't hold (see
       * `defaultUseWorkspaces`).
       */
      getPreferenceDefault(key: string): unknown {
        return getConf(self, ['preferences', key])
      },
      /**
       * #method
       * resolved value of a user preference: a runtime override if the user set
       * one, otherwise the admin/embedder `configuration.preferences` default.
       * The override map is empty unless the product loads it (web/desktop).
       */
      getPreference(key: string): unknown {
        const override = self.preferencesOverrides.get(key)
        return override === undefined
          ? this.getPreferenceDefault(key)
          : override
      },
      /**
       * #method
       * every scalar preference override that currently differs from its
       * config/admin default, as `{ path, from, to }` rows whose path is the
       * override's own key. A scalar pref (animationMode, scrollZoom) whose
       * override equals the default is omitted, since reverting it is a no-op.
       */
      getPreferenceChanges(): TrackConfigChange[] {
        const changes: TrackConfigChange[] = []
        for (const [key, value] of self.preferencesOverrides.entries()) {
          const dflt = this.getPreferenceDefault(key)
          if (value !== dflt) {
            changes.push({
              path: [key],
              from: dflt,
              to: value,
            } as TrackConfigChange)
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
      /**
       * #getter
       * resolved thousand-separator preference. Read for display in the
       * Preferences dialog; the formatter itself reads a plain module variable
       * set at startup in each realm (see `setNumberGrouping`), because worker-
       * built strings can't see a main-thread observable.
       */
      get numberGrouping(): boolean {
        return self.getPreference('numberGrouping') !== false
      },
    }))
    .actions(self => ({
      afterAttach() {
        // push the admin/embedder default down to the formatter, which is a
        // plain module variable rather than an observable (see
        // `setNumberGrouping`). Embedded products stop here; web and desktop
        // compose PreferencesSessionMixin, whose own afterAttach runs after
        // this one and re-applies the value once the user's stored overrides
        // are loaded, so a user override still wins over the config default.
        setNumberGrouping(self.numberGrouping)
      },
      /**
       * #action
       * set the global selection, i.e. the globally-selected object. can be a
       * feature, a view, just about anything
       *
       * A feature is unwrapped on the way in, so app state never holds a
       * jexlFeatureProxy. `isFeature` accepts a proxy, but on one `id` is a
       * data field rather than the method the Feature type promises — every
       * consumer doing `isFeature(selection) ? selection.id() : …` would throw.
       */
      setSelection(thing: unknown) {
        self.selection = isFeature(thing) ? unwrapFeature(thing) : thing
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
       * turn highlight bands back on, so a newly made highlight or bookmark is
       * never silently swallowed by an earlier "highlights off"
       */
      revealHighlights() {
        self.highlightsVisible = true
      },
      /**
       * #action
       * set a runtime user-preference override (see `getPreference`). Mutates
       * volatile state; products persist these to localStorage. An `undefined`
       * value deletes the key (rather than leaving a phantom entry that
       * `getPreference` reads as absent) so the store never holds dead keys.
       */
      setPreferenceOverride(key: string, value: unknown) {
        if (value === undefined) {
          self.preferencesOverrides.delete(key)
        } else {
          // frozen because `deep: false` hands an object-valued preference
          // straight back out by reference, so the "nothing mutates a
          // preference in place" this store relies on is enforced rather than
          // assumed
          self.preferencesOverrides.set(key, freezeDeep(value))
        }
      },
      /**
       * #action
       * clear every runtime preference override at once, so each falls back to
       * its config/admin default. Backs the Preferences dialog "Reset to
       * defaults" button.
       */
      clearPreferenceOverrides() {
        self.preferencesOverrides.clear()
      },
      /**
       * #action
       * clear a single runtime preference override (see `getPreference`) so it
       * falls back to its config/admin default. Backs the per-entry reset in the
       * Preferences dialog "Reset to defaults" confirmation.
       */
      clearPreferenceOverride(key: string) {
        self.preferencesOverrides.delete(key)
      },
      /**
       * #action
       * set the global scroll-to-zoom preference (see the `scrollZoom` getter)
       */
      setScrollZoom(flag: boolean) {
        this.setPreferenceOverride('scrollZoom', flag)
      },
      /**
       * #action
       */
      setName(str: string) {
        self.name = str
      },
      /**
       * #action
       * `undefined` is "no view is focused", which the property has always been
       * able to hold (`types.maybe`) and this had no way to spell. Nothing
       * cleared it on teardown as a result: a view that was focused when it left
       * the session left its id behind, and since every consumer compares
       * `focusedViewId === view.id`, the id matched nothing, the focus ring
       * vanished with nothing to say why, and the dead id persisted into a saved
       * or shared session. `takeOut` clears it now.
       */
      setFocusedViewId(viewId: string | undefined) {
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

  return types.compose(baseModel, SnackbarModel()).actions(self => ({
    // after the compose rather than in the afterAttach above, because the
    // notices land in the snackbar this line is the first place to hold both
    // halves of. Web and desktop reach it a second time once the user's stored
    // overrides are loaded (`PreferencesSessionMixin`), and our MST fork
    // auto-chains both hooks.
    afterAttach() {
      applyDeveloperMode(self)
    },
  }))
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
