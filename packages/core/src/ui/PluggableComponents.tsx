import { Suspense } from 'react'

import { observer } from 'mobx-react'

import type PluginManager from '../PluginManager.ts'
import type {
  ExtensionPointArgs,
  ExtensionPointName,
  ExtensionPointProps,
  ExtensionPointPropsArgs,
  ExtensionPointRegistry,
} from '../PluginManager.ts'
import type { ComponentType } from 'react'

/**
 * The extension points that accumulate an array of *components* — the panel
 * points. Points accumulating rendered `ReactNode`s belong to
 * {@link PluggableElements}, and the two sets cannot overlap: a `ReactNode` is
 * never a component.
 *
 * The props the components take have to be the ones the point declares, which
 * is also what keeps a point whose entries merely *look* callable out. A bare
 * `ComponentType<never>` test admits any one-argument function returning a
 * string, `Core-guessTrackTypeForLocation` among them.
 */
export type ComponentExtensionPointName = {
  [N in ExtensionPointName]: 'props' extends keyof ExtensionPointRegistry[N]
    ? ExtensionPointArgs<N> extends ComponentType<ExtensionPointProps<N>>[]
      ? N
      : never
    : never
}[ExtensionPointName]

/**
 * The props a component point hands its panels. Read off the registry entry
 * rather than through `ExtensionPointProps`, whose fallback branch for an
 * undeclared point widens this to `Record<string, unknown>` — which then cannot
 * be spread into a component, since every point here declares its props.
 */
export type PanelProps<N extends ComponentExtensionPointName> =
  ExtensionPointRegistry[N]['props']

/**
 * Render every component contributed to an accumulating point, in registration
 * order, each with the point's props.
 *
 * The component sibling of {@link PluggableElements}. Owning the loop here is
 * what makes a new panel seam one tag rather than a producer that re-derives
 * the `Suspense` boundary, the keys and the legacy normalization — each of
 * which was wrong in one of the two producers that used to hand-roll it.
 *
 * A contributed panel scopes itself, rendering `null` when it does not apply;
 * {@link ForTrack} is the declarative way to say so. It also draws its own card
 * chrome, since only the panel knows whether it wants a title.
 */
const PluggableComponents = observer(function PluggableComponents<
  N extends ComponentExtensionPointName,
>({
  pluginManager,
  name,
  props,
}: {
  pluginManager: PluginManager
  name: N
  props: PanelProps<N>
}) {
  // restated for the same reason as PluggableElements: neither the empty
  // accumulator nor the props narrow through the generic key. [x].flat()
  // tolerates a pre-v5 callback that returned one component instead of appending
  const components = [
    pluginManager.evaluateExtensionPoint(
      name,
      [] as ExtensionPointArgs<N>,
      ...([props] as ExtensionPointPropsArgs<N>),
    ),
  ].flat() as ComponentType<PanelProps<N>>[]
  return (
    <>
      {components.map((Component, i) => (
        <Suspense
          // eslint-disable-next-line @eslint-react/no-array-index-key -- registration-ordered, so stable across renders
          key={i}
          fallback={null}
        >
          <Component {...props} />
        </Suspense>
      ))}
    </>
  )
})

export default PluggableComponents
