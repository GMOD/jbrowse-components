import { Suspense } from 'react'

import { observer } from 'mobx-react'

import type PluginManager from '../PluginManager.ts'
import type {
  ExtensionPointArgs,
  ExtensionPointPropsArgs,
  ExtensionPointRegistry,
  PointsOfKind,
} from '../PluginManager.ts'
import type { ComponentType } from 'react'

/**
 * The extension points that accumulate an array of components — every point
 * declared `ComponentList`. Points accumulating rendered `ReactNode`s are
 * `ElementList` instead, and belong to {@link PluggableElements}.
 */
export type ComponentExtensionPointName = PointsOfKind<'componentList'>

/** The props a component point hands each of its panels. */
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
 * A contributed panel scopes itself, rendering `null` when it does not apply —
 * {@link matchesTrackSelector} is what decides that. It also draws its own card
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
