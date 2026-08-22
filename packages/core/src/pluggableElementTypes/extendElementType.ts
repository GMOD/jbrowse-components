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

/**
 * Replace a view type's state model with an extended one, e.g. to add a menu
 * item to `LinearGenomeView`.
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
  name: N,
  extend: (stateModel: ViewTypeRegistry[N]) => IAnyModelType,
) {
  pluginManager.addToExtensionPoint(
    'Core-extendPluggableElement',
    (element, props) => {
      if (props.group === 'view' && element.name === name) {
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
        //
        // Routed through extendStateModel rather than assigning `.stateModel`
        // directly so a view registered with a lazy loader queues the
        // extension and composes it when the loader resolves.
        const view = element as {
          extendStateModel: (
            extend: (stateModel: IAnyModelType) => IAnyModelType,
          ) => void
        }
        view.extendStateModel(widen(extend))
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
  name: N,
  extend: (stateModel: DisplayTypeRegistry[N]) => IAnyModelType,
) {
  pluginManager.addToExtensionPoint(
    'Core-extendPluggableElement',
    (element, props) => {
      if (props.group === 'display' && element.name === name) {
        // widened for the reason in extendViewType; routed through
        // extendStateModel so a lazy registration queues the extension
        const display = element as {
          extendStateModel: (
            extend: (stateModel: IAnyModelType) => IAnyModelType,
          ) => void
        }
        display.extendStateModel(widen(extend))
      }
      return element
    },
  )
}
