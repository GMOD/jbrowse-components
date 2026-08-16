import { observer } from 'mobx-react'

import type PluginManager from '../PluginManager.ts'
import type {
  ExtensionPointArgs,
  ExtensionPointProps,
  ExtensionPointPropsArgs,
} from '../PluginManager.ts'
import type { ElementExtensionPointName } from './addExtensionElement.tsx'

/**
 * Render every element contributed to an accumulating point — the overlay
 * points, whose entries are `ReactNode`s put there by `addExtensionElement`.
 *
 * The list sibling of {@link PluggableComponent}, which renders the single
 * component a `single` point resolves to. Which one a point takes is decided by
 * its registry entry, not by the call site: `ElementExtensionPointName` accepts
 * only the points whose `args` are `ReactNode[]`, so asking for a slot point
 * here is a compile error rather than a component that renders nothing.
 *
 * observer for the same reason PluggableComponent is one: a contributor may
 * scope itself on an observable, and the fold runs here rather than in the
 * producer, so the read has to be tracked by this component's own reaction.
 */
const PluggableElements = observer(function PluggableElements<
  N extends ElementExtensionPointName,
>({
  pluginManager,
  name,
  props,
}: {
  pluginManager: PluginManager
  name: N
  props: ExtensionPointProps<N>
}) {
  // the empty accumulator is the point's own array type, and `props` satisfies
  // its declared props by the signature above. TS can't narrow either through
  // the generic key, so both are restated here — same as PluggableComponent
  const elements = pluginManager.evaluateExtensionPoint(
    name,
    [] as ExtensionPointArgs<N>,
    ...([props] as ExtensionPointPropsArgs<N>),
  )
  return <>{elements}</>
})

export default PluggableElements
