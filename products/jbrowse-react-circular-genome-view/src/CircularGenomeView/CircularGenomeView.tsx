import { useImperativeHandle } from 'react'

import { useCreateOnce } from '@jbrowse/product-core'
import { observer } from 'mobx-react'

import JBrowseCircularGenomeView from '../JBrowseCircularGenomeView/index.ts'
import createViewState from '../createViewState.ts'

import type { ViewModel } from '../createModel/createModel.ts'
import type { CreateViewStateBaseOptions } from '../createViewState.ts'
import type { Ref } from 'react'

export interface CircularGenomeViewProps extends CreateViewStateBaseOptions {
  // ref to the live engine, for imperative control after launch (showTrack,
  // ...). Good for firing an action from an event handler; a host that has to
  // *read* the engine while rendering — to disable its own button until the
  // view is up, to show what is on the ring — gets it a render too late, and
  // should build the engine with useCreateViewState
  ref?: Ref<ViewModel>
}

/**
 * Uncontrolled, prop-driven wrapper around the `viewState`-based
 * {@link JBrowseCircularGenomeView}. Props are initial values (like an input's
 * `defaultValue`): the engine is constructed once and later prop changes are
 * ignored. To swap assembly/plugins, remount via React `key`.
 *
 * `init` is the declarative input; for imperative control after launch take a
 * `ref` to the live engine. The `ref` arrives a render after mount, so a host
 * that needs the engine *during* render should call {@link useCreateViewState}
 * with the same options and render `<JBrowseCircularGenomeView>` itself — that
 * is this component's body, minus the ref.
 *
 * This owns its engine for the lifetime of the page and does not tear it down:
 * the engine is not owned by React, so unmounting leaves its RPC worker threads
 * and autoruns running. That is fine for a page that mounts one and keeps it,
 * and a leak for a host that mounts and discards repeatedly — an SPA route, a
 * notebook cell re-run. Those should use {@link useCreateViewState} +
 * `<JBrowseCircularGenomeView>`, which destroys the engine on unmount, or
 * `createCircularGenomeView`, which owns the whole lifecycle.
 */
const CircularGenomeView = observer(function CircularGenomeView({
  ref,
  ...rest
}: CircularGenomeViewProps) {
  // `init` is passed straight through: createViewState takes the same blob and
  // fills in the assembly name, so this component is the prop-shaped face of
  // that call and nothing about launching a view lives only here. With no init
  // the configured assembly is drawn anyway — a circular view's default is the
  // whole genome, unlike the linear product, where no init means the import
  // form.
  //
  // `useCreateOnce`, not `useState(() => …)`: StrictMode double-invokes a state
  // initializer and discards the second result, which for an engine is a whole
  // orphaned worker pool per mount, and this component never destroys anything.
  const state = useCreateOnce(() => createViewState(rest))

  useImperativeHandle(ref, () => state, [state])

  return <JBrowseCircularGenomeView viewState={state} />
})

export default CircularGenomeView
