import type PluginManager from '../PluginManager.ts'
import type {
  DisplayTypeName,
  DisplayTypeRegistry,
  ViewTypeName,
  ViewTypeRegistry,
} from '../PluginManager.ts'
import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

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
        // the group check established this element is a ViewType, and the
        // registry says which one, so both halves of this are proven
        const view = element as { stateModel: ViewTypeRegistry[N] }
        view.stateModel = extend(view.stateModel)
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
        const display = element as { stateModel: DisplayTypeRegistry[N] }
        display.stateModel = extend(display.stateModel)
      }
      return element
    },
  )
}
