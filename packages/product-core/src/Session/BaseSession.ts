import { getConf } from '@jbrowse/core/configuration'
import SnackbarModel from '@jbrowse/core/ui/SnackbarModel'
import { setNumberGrouping } from '@jbrowse/core/util'
import { freezeDeep } from '@jbrowse/core/util/freezeDeep'
import { isFeature, unwrapFeature } from '@jbrowse/core/util/simpleFeature'
import { ElementId } from '@jbrowse/core/util/types/mst'
import {
  getParent,
  isAlive,
  isStateTreeNode,
  types,
} from '@jbrowse/mobx-state-tree'
import { observable } from 'mobx'

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

// How long the scroll-to-zoom prompt stays down after a raise, and the ceiling
// that doubling walks up to (see `noteScrollZoomHintShown`). The first pause is
// short because the prompt answers a gesture that just failed, and a wheel that
// did nothing is still a wheel that did nothing on the fourth try — this used to
// be a budget of three raises and then silence for the session, which left a
// user who had met the prompt and forgotten it with a dead wheel and no reply.
const SCROLL_ZOOM_HINT_PAUSE_MS = 30_000
const SCROLL_ZOOM_HINT_MAX_PAUSE_MS = 10 * 60_000

// Promoted per-display-type slot defaults live flat in `preferencesOverrides`
// under one composite key each (`displayTypeDefault\0<type>\0<slot>`), not under
// a single nested `displayTypeDefaults` object. Flat keys make each promoted
// default its own tracked observable-map entry — promoting one can't invalidate
// a reader of another (every promotable display's `rpcProps` reads one via
// `getDisplayTypeDefault`) — and collapse the get/set/diff logic to one lookup.
// The `\0` delimiter can't appear in a display type or slot name.
// The literal is a **persisted localStorage key prefix**, so treat it as data
// rather than as an identifier a rename should sweep — a blanket
// `displayTypeDefault` → `pin` pass did sweep it, and orphans every promoted
// default already in a browser's storage. Nothing released stores these yet, so
// the reason it keeps this spelling is naming, not compatibility: the key names
// *what is stored* (a display-type default, reached through
// `get/setDisplayTypeDefault`), while `Pin` names the menu control that writes
// it.
const DISPLAY_TYPE_DEFAULT_PREFIX = 'displayTypeDefault\0'

// Module-private on purpose: the composite-key spelling is a storage detail of
// this file's get/set/diff methods, and nothing outside it should be able to
// depend on the layout.
function displayTypeDefaultKey(displayType: string, slot: string) {
  return `${DISPLAY_TYPE_DEFAULT_PREFIX}${displayType}\0${slot}`
}

function parseDisplayTypeDefaultKey(key: string) {
  const rest = key.startsWith(DISPLAY_TYPE_DEFAULT_PREFIX)
    ? key.slice(DISPLAY_TYPE_DEFAULT_PREFIX.length)
    : ''
  const [displayType, slot] = rest.split('\0')
  return displayType && slot ? { displayType, slot } : undefined
}

// Head of the display path a promoted default takes in a `getPreferenceChanges`
// row: `[DISPLAY_TYPE_DEFAULTS_PATH_HEAD, displayType, slot]`. Purely a
// readable row label, deliberately distinct from the flat
// `DISPLAY_TYPE_DEFAULT_PREFIX` storage key above.
//
// Module-private, like the storage key: both the producer
// (`getPreferenceChanges`) and the consumer (`resetPreferenceChange`) are
// methods on this model, so the two path shapes this file emits are the only
// ones it has to undo. It used to be exported for the Preferences dialog to
// match on and re-route back through `setDisplayTypeDefault`, which meant a
// rename on one side alone would silently no-op that dialog's per-row reset.
const DISPLAY_TYPE_DEFAULTS_PATH_HEAD = 'displayTypeDefaults'

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
       * invalidate a reader of another (`getDisplayTypeDefault` in a track's
       * `rpcProps`). A single spread-replaced object made every setter wake
       * every reader, so toggling scroll-to-zoom re-fetched every track. For the
       * same reason each promoted per-display-type default is a flat composite
       * key (see `displayTypeDefaultKey`), not a single nested `displayTypeDefaults`
       * object — promoting one default can't wake readers of a different one.
       *
       * `deep: false` is load-bearing, not a micro-optimization. The default
       * enhancer wraps an object/array value in a MobX Proxy on `set`, and a
       * promoted default is handed straight back out by `getConf` — so an
       * object-valued promotable slot (alignments `colorBy`) put a Proxy into
       * `rpcProps()`, and V8's structured-clone serializer rejects a Proxy:
       * `worker.postMessage` threw `DataCloneError` on the next fetch of any
       * track following that default (electron IPC and `structuredClone` in the
       * share bake likewise). The map still notifies per key on `set`, so shallow
       * values lose no reactivity — and nothing can mutate a preference in place,
       * because `setPreferenceOverride` freezes what it stores.
       */
      preferencesOverrides: observable.map<string, unknown>(undefined, {
        deep: false,
      }),
      /**
       * #volatile
       * how many times the scroll-to-zoom prompt has been raised this session.
       * Each raise buys a longer quiet than the last (see
       * `noteScrollZoomHintShown`), so this is the backoff's exponent as well
       * as a count.
       *
       * Session-wide rather than per view, because the thing being paced is the
       * user's attention and they only have one: a synteny view is two genome
       * views and a ribbon band, each with its own copy of the prompt, and
       * three independent counters would interrupt three times over.
       *
       * Volatile, so it resets on reload. That is the intent — a persisted
       * count would carry one afternoon's backoff into every session after it,
       * and a user who never enabled the preference is exactly the one who
       * might still want to know.
       */
      scrollZoomHintCount: 0,
      /**
       * #volatile
       * whether the scroll-to-zoom prompt is currently quiet — see
       * `canShowScrollZoomHint`, which is this read the right way round, and
       * `noteScrollZoomHintShown`, whose block owns the timer that lifts it.
       */
      scrollZoomHintPaused: false,
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
       * resolved value of a per-display-type slot default the user promoted
       * (see `setDisplayTypeDefault`); undefined when nothing was promoted.
       */
      getDisplayTypeDefault(displayType: string, slot: string): unknown {
        return self.preferencesOverrides.get(
          displayTypeDefaultKey(displayType, slot),
        )
      },
      /**
       * #method
       * every per-display-type default the user has promoted, as
       * `{ displayType, slot, value }` — the inventory the Preferences dialog
       * lists and clears one at a time (`setDisplayTypeDefault(…, undefined)`).
       *
       * Here rather than filtered out of `getPreferenceChanges` by the dialog,
       * because the composite-key layout is this file's: a consumer that
       * recognized these rows by matching the path head is exactly the coupling
       * `DISPLAY_TYPE_DEFAULTS_PATH_HEAD` stopped being exported over, where a
       * rename on one side alone silently no-ops the other.
       */
      getDisplayTypeDefaults(): {
        displayType: string
        slot: string
        value: unknown
      }[] {
        const found = []
        for (const [key, value] of self.preferencesOverrides.entries()) {
          const parsed = parseDisplayTypeDefaultKey(key)
          if (parsed) {
            found.push({ ...parsed, value })
          }
        }
        return found
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
        for (const [key, value] of self.preferencesOverrides.entries()) {
          const dtd = parseDisplayTypeDefaultKey(key)
          if (dtd) {
            changes.push({
              path: [
                DISPLAY_TYPE_DEFAULTS_PATH_HEAD,
                dtd.displayType,
                dtd.slot,
              ],
              from: undefined,
              to: value,
            } as TrackConfigChange)
          } else {
            const dflt = this.getPreferenceDefault(key)
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
      /**
       * #getter
       * whether the scroll-to-zoom prompt may be raised right now. It is shown
       * for a wheel that did nothing at all, which in a view that has run out
       * of page to scroll is *every* wheel — so unpaced the prompt is not a
       * hint, it is a recurring interruption for anyone who has decided they
       * don't want the preference.
       *
       * Paced rather than budgeted, and the difference is the point: a budget
       * spent is silence for the rest of the session, and the gesture it
       * answers goes on being dead long after that. Knowing the preference
       * exists is not the same as remembering where it lives, or as expecting
       * the wheel to do nothing on this particular view.
       */
      get canShowScrollZoomHint(): boolean {
        return !self.scrollZoomHintPaused
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
          // frozen because `deep: false` hands an object-valued preference (a
          // promoted `colorBy`) straight back out by reference to every display
          // following it, so the "nothing mutates a preference in place" this
          // store relies on is enforced rather than assumed
          self.preferencesOverrides.set(key, freezeDeep(value))
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
       * revert one row emitted by `getPreferenceChanges`, addressed by its
       * display `path`. Backs the per-entry reset in the Preferences dialog's
       * "Reset to defaults" confirmation.
       *
       * Lives here rather than in that dialog because this model owns both path
       * shapes it has to undo: a promoted per-display-type default, whose row
       * path is a readable label over a flat composite storage key, and every
       * other override, whose path *is* its key. The dialog used to re-derive
       * the first case from an exported path-head constant.
       */
      resetPreferenceChange(path: string[]) {
        const [head, displayType, slot] = path
        if (head === DISPLAY_TYPE_DEFAULTS_PATH_HEAD && displayType && slot) {
          this.setDisplayTypeDefault(displayType, slot, undefined)
        } else if (head) {
          this.clearPreferenceOverride(head)
        }
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
       * quiet the scroll-to-zoom prompt, or let it speak again. The pacing
       * that calls this — `noteScrollZoomHintShown` and
       * `snoozeScrollZoomHints` — owns the timer that lifts it; this is the
       * plain write, and the seam a probe or a test sets by hand.
       */
      setScrollZoomHintPaused(flag: boolean) {
        self.scrollZoomHintPaused = flag
      },
      /**
       * #action
       * promote (or, with `value` undefined, clear) a per-display-type slot
       * default. Just a preference override under one flat composite key (see
       * `displayTypeDefaultKey`), so it persists and independently tracks like
       * any other pref, and clearing deletes only that key.
       */
      setDisplayTypeDefault(displayType: string, slot: string, value: unknown) {
        this.setPreferenceOverride(
          displayTypeDefaultKey(displayType, slot),
          value,
        )
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
    // The scroll-to-zoom prompt's pacing, in a block of its own because it is
    // the one thing here holding a timer.
    .actions(self => {
      let resumeTimer: ReturnType<typeof setTimeout> | undefined
      function pauseFor(ms: number) {
        clearTimeout(resumeTimer)
        self.setScrollZoomHintPaused(true)
        resumeTimer = setTimeout(() => {
          // a session can be torn down inside a pause — a test, or the app
          // loading another session — and an action on a dead node throws.
          // Also the backstop for a mixin composed over this one that declares
          // its own `beforeDestroy`, which would replace the one below
          if (isAlive(self)) {
            self.setScrollZoomHintPaused(false)
          }
        }, ms)
      }
      return {
        /**
         * #action
         * the prompt has just been raised: count it, and quiet it for a while.
         *
         * The while doubles with each raise, up to
         * SCROLL_ZOOM_HINT_MAX_PAUSE_MS. Backoff rather than a budget because
         * the two failure modes pull opposite ways — a user who ignores the
         * prompt is being interrupted and wants it to stop, and a user who
         * ignores it is also the one most likely to still not know what the
         * wheel is doing. Doubling serves both and never reaches never: 30s, a
         * minute, two, four, and by then anyone still seeing it is meeting a
         * dead wheel every few minutes, which is a real problem the prompt is
         * the answer to.
         */
        noteScrollZoomHintShown() {
          self.scrollZoomHintCount += 1
          pauseFor(
            Math.min(
              SCROLL_ZOOM_HINT_PAUSE_MS * 2 ** (self.scrollZoomHintCount - 1),
              SCROLL_ZOOM_HINT_MAX_PAUSE_MS,
            ),
          )
        },
        /**
         * #action
         * the user replied to the prompt rather than letting it lapse — escape,
         * or a press somewhere else. Straight to the longest quiet, without
         * spending the backoff on the way: an answer is "not now", which is
         * worth more than a raise that may not have been read at all.
         *
         * Not "never" any more, and deliberately. Setting the preference from
         * anywhere used to end the prompt for the session, on the reasoning
         * that whoever set it had found it — but the gesture goes on being dead
         * for the user who turned it back *off*, and knowing a preference
         * exists is not the same as remembering where it lives.
         */
        snoozeScrollZoomHints() {
          pauseFor(SCROLL_ZOOM_HINT_MAX_PAUSE_MS)
        },
        beforeDestroy() {
          clearTimeout(resumeTimer)
        },
      }
    })

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
