import type PluginManager from '../PluginManager.ts'
import type {
  DisplayTypeName,
  DisplayTypeRegistry,
  ViewTypeName,
  ViewTypeRegistry,
} from '../PluginManager.ts'
import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

// The one cast, in one place, named. `extend` is written by a caller against a
// registry entry; this package cannot name that entry (see extendViewType), so
// the callback is re-read as taking the base model type to call it.
function widen<T>(extend: (stateModel: T) => IAnyModelType) {
  return extend as unknown as (stateModel: IAnyModelType) => IAnyModelType
}

// Built once per registration rather than per element: the point fires for
// every pluggable element there is, and every callback registered on it runs
// for each one.
function namesOf(name: string | readonly string[]) {
  return new Set(typeof name === 'string' ? [name] : name)
}

/**
 * Replace a view type's state model with an extended one, e.g. to add a menu
 * item to `LinearGenomeView`. Pass an array to extend several at once, which is
 * how a contribution reaches a family: the tree spells a display family as a
 * shared mixin set rather than a chain, so there is no parent to name — see
 * `reference/REJECTED_IDEAS.md`, "Give a pluggable element an `extendsType`".
 *
 * `Core-extendPluggableElement` fires for every pluggable element there is —
 * adapters, widgets, RPC methods, all of them — so a callback written against
 * it directly has to match the name, convince TypeScript the element is the
 * kind that name implies, and remember to return the element. The middle one
 * has no honest answer at the call site, which is why the two plugins that
 * tried both landed on a type guard asserting `elt is DisplayType` from a
 * string compare, which would go on asserting it if the name ever belonged to
 * something else.
 *
 * Here the group is checked rather than asserted — it comes from
 * `addElementType`, which knew it all along — and the name is checked against
 * `ViewTypeRegistry`, so the state model arrives typed and a rename is a
 * compile error rather than an extension that quietly stops applying.
 */
export function extendViewType<N extends ViewTypeName>(
  pluginManager: PluginManager,
  name: N | readonly N[],
  extend: (stateModel: ViewTypeRegistry[N]) => IAnyModelType,
) {
  const names = namesOf(name)
  pluginManager.addToExtensionPoint(
    'Core-extendPluggableElement',
    (element, props) => {
      if (props.group === 'view' && names.has(element.name)) {
        // The group check established this element is a ViewType, and the
        // registry says which one, so the read is proven. The body still works
        // in `IAnyModelType`: `ViewTypeRegistry` is declared empty here and
        // filled by module augmentation, so inside this package `ViewTypeName`
        // is `never` and `ViewTypeRegistry[N]` with it — a value of that type
        // cannot be produced or consumed, and compiling core alone fails on
        // both. The precise type is what the *caller* gets, which is the whole
        // point of the signature; widening it once here costs nothing, since
        // the only operation is handing the model to `extend` and storing what
        // comes back.
        const view = element as { stateModel: IAnyModelType }
        view.stateModel = widen(extend)(view.stateModel)
      }
      return element
    },
  )
}

/**
 * Replace a display type's state model with an extended one. See
 * {@link extendViewType}; the name is checked against `DisplayTypeRegistry`.
 */
export function extendDisplayType<N extends DisplayTypeName>(
  pluginManager: PluginManager,
  name: N | readonly N[],
  extend: (stateModel: DisplayTypeRegistry[N]) => IAnyModelType,
) {
  const names = namesOf(name)
  pluginManager.addToExtensionPoint(
    'Core-extendPluggableElement',
    (element, props) => {
      if (props.group === 'display' && names.has(element.name)) {
        // widened for the reason in extendViewType
        const display = element as { stateModel: IAnyModelType }
        display.stateModel = widen(extend)(display.stateModel)
      }
      return element
    },
  )
}
