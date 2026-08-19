import { wrappedComponent } from '../PluginManager.ts'

import type PluginManager from '../PluginManager.ts'
import type {
  ExtensionPointArgs,
  ExtensionPointName,
  ExtensionPointProps,
  ExtensionPointRegistry,
} from '../PluginManager.ts'
import type { Attributes, ComponentType } from 'react'

/**
 * The extension points that resolve to a single component — a slot with a
 * default, which a plugin wraps or replaces. `Core-replaceWidget`,
 * `Core-replaceAbout` and the desktop start-screen panels are all this shape;
 * {@link PluggableComponent} is the producer side.
 *
 * Matching on the point's declared props as well as its args is what keeps a
 * point whose value merely *looks* callable out: a bare `ComponentType<never>`
 * test admits `Core-guessTrackTypeForLocation`, whose guesser takes arguments
 * and returns a string, both of which a function component may also do.
 */
export type SlotExtensionPointName = {
  [N in ExtensionPointName]: 'props' extends keyof ExtensionPointRegistry[N]
    ? ExtensionPointArgs<N> extends ComponentType<ExtensionPointProps<N>>
      ? N
      : never
    : never
}[ExtensionPointName]

/**
 * The props the component in slot `N` is rendered with. Read off the registry
 * entry rather than inferred back out of the component type, so it stays an
 * object type a wrapper's props can be spread from.
 */
export type SlotProps<N extends SlotExtensionPointName> =
  ExtensionPointRegistry[N]['props']

export type WrapperProps<N extends SlotExtensionPointName> = SlotProps<N> & {
  /**
   * whatever fills the slot so far: the built-in default, or another plugin's
   * wrapper. Render it where you want it to appear, or leave it out to take the
   * slot over entirely
   */
  DefaultComponent: ComponentType<SlotProps<N>>
}

/**
 * Put `wrapper` around whatever currently fills a single-component slot. It
 * receives the slot's props plus the component it wraps, so wrappers from
 * several plugins nest rather than clobbering one another, and scoping is a
 * plain conditional:
 *
 * ```tsx
 * wrapComponent(pm, 'Core-replaceWidget', ({ DefaultComponent, ...props }) => (
 *   <ForTrack
 *     {...props}
 *     select={{ trackId: 'volvox.inv.vcf' }}
 *     fallback={<DefaultComponent {...props} />}
 *   >
 *     <MyWidget {...props} />
 *   </ForTrack>
 * ))
 * ```
 *
 * Wrapping is the only operation these points have, because replacing is
 * wrapping and not rendering what you were handed. Registering on the point
 * directly does the same thing, minus the two halves this gets right:
 *
 * - the fold reruns on **every render** of the producer, so a wrapper declared
 *   inside the callback is a new component type each time and React unmounts the
 *   subtree, losing scroll position, form state and any open sub-panel. Here the
 *   wrapped component is built once and cached per component wrapped.
 * - a hand-written callback that forgets to hand back the accumulated component
 *   on the tracks it does not want takes over the drawer, the modal and every
 *   feature details panel.
 */
export function wrapComponent<N extends SlotExtensionPointName>(
  pluginManager: PluginManager,
  name: N,
  wrapper: ComponentType<WrapperProps<N>>,
) {
  const Wrapper = wrapper
  const cache = new WeakMap<
    ComponentType<SlotProps<N>>,
    ComponentType<SlotProps<N>>
  >()
  pluginManager.addToExtensionPoint(name, (accumulated: unknown) => {
    const Default = accumulated as ComponentType<SlotProps<N>>
    let built = cache.get(Default)
    if (!built) {
      const made = (slotProps: SlotProps<N>) => {
        // the literal is what checks the wrapper's props. The assertion is for
        // JSX alone: it checks attributes against a type made entirely of
        // optionals, and through `N` tsc cannot see this one has any property in
        // common with it, so a plain spread reads as the weak-type mistake
        const wrapperProps: WrapperProps<N> = {
          ...slotProps,
          DefaultComponent: Default,
        }
        return <Wrapper {...(wrapperProps as WrapperProps<N> & Attributes)} />
      }
      made.displayName = `${Wrapper.displayName ?? Wrapper.name}(${
        Default.displayName ?? Default.name
      })`
      // records what it wraps, so evaluateComponentExtensionPoint counts this
      // as composition rather than as taking the slot
      Object.defineProperty(made, wrappedComponent, { value: Default })
      cache.set(Default, made)
      built = made
    }
    return built as ExtensionPointArgs<N>
  })
}
