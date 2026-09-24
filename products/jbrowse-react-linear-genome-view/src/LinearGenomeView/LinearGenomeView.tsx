import { useImperativeHandle } from 'react'

import { useCreateOnce } from '@jbrowse/product-core'

import JBrowseLinearGenomeView from '../JBrowseLinearGenomeView/index.ts'
import createViewState from '../createViewState.ts'

import type { ViewModel } from '../createModel/createModel.ts'
import type { CreateViewStateBaseOptions } from '../createViewState.ts'
import type { Ref } from 'react'

export interface LinearGenomeViewProps extends CreateViewStateBaseOptions {
  // ref to the live engine, for imperative control after launch
  // (navToLocString, showTrack, ...). Good for firing an action from an event
  // handler; a host that has to *read* the engine while rendering — to disable
  // its own button until the view is up, to show what is on screen — gets it a
  // render too late, and should build the engine with useCreateViewState
  ref?: Ref<ViewModel>
}

/**
 * Uncontrolled, prop-driven wrapper around the `viewState`-based
 * {@link JBrowseLinearGenomeView}. Props are initial values (like an input's
 * `defaultValue`): the engine is constructed once and later prop changes are
 * ignored. To swap assembly/plugins, remount via React `key`.
 *
 * `view` is the declarative input; for imperative control after launch take a
 * `ref` to the live engine. The `ref` arrives a render after mount, so a host
 * that needs the engine *during* render should call {@link useCreateViewState}
 * with the same options and render `<JBrowseLinearGenomeView>` itself — that is
 * this component's body, minus the ref.
 *
 * This owns its engine for the lifetime of the page and does not tear it down:
 * the engine is not owned by React, so unmounting leaves its RPC worker threads
 * and autoruns running. That is fine for a page that mounts one and keeps it,
 * and a leak for a host that mounts and discards repeatedly — an SPA route, a
 * notebook cell re-run. Those should use {@link useCreateViewState} +
 * `<JBrowseLinearGenomeView>`, which destroys the engine on unmount, or
 * `createLinearGenomeView`, which owns the whole lifecycle.
 */
export default function LinearGenomeView({
  ref,
  ...rest
}: LinearGenomeViewProps) {
  // `useCreateOnce`, not `useState(() => …)`: StrictMode double-invokes a state
  // initializer, which for an engine orphans a whole worker pool
  const state = useCreateOnce(() => createViewState(rest))

  useImperativeHandle(ref, () => state, [state])

  return <JBrowseLinearGenomeView viewState={state} />
}
