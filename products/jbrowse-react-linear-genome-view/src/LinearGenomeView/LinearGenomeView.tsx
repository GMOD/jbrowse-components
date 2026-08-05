import { useImperativeHandle, useState } from 'react'

import { observer } from 'mobx-react'

import JBrowseLinearGenomeView from '../JBrowseLinearGenomeView/index.ts'
import createViewState from '../createViewState.ts'

import type { ViewModel } from '../createModel/createModel.ts'
import type { CreateViewStateBaseOptions } from '../createViewState.ts'
import type { InitState } from '@jbrowse/plugin-linear-genome-view'
import type { Ref } from 'react'

export interface LinearGenomeViewProps extends CreateViewStateBaseOptions {
  // declarative description of the initial view: optional loc, tracks to show,
  // highlights, nav/tracklist visibility, etc. mirrors the view's own `init`
  // shape (minus `assembly`, which is taken from the `assembly` prop), so the
  // same blob round-trips through saved sessions and URL specs
  init?: Omit<InitState, 'assembly'>
  // ref to the live engine, for imperative control after launch
  // (navToLocString, showTrack, ...)
  ref?: Ref<ViewModel>
}

/**
 * Uncontrolled, prop-driven wrapper around the `viewState`-based
 * {@link JBrowseLinearGenomeView}. Props are initial values (like an input's
 * `defaultValue`): the engine is constructed once and later prop changes are
 * ignored. To swap assembly/plugins, remount via React `key`.
 *
 * `init` is the declarative input; for imperative control after launch take a
 * `ref` to the live engine.
 *
 * This owns its engine for the lifetime of the page and does not tear it down:
 * the engine is not owned by React, so unmounting leaves its RPC worker threads
 * and autoruns running. That is fine for a page that mounts one and keeps it,
 * and a leak for a host that mounts and discards repeatedly — an SPA route, a
 * notebook cell re-run. Those should build the engine themselves
 * ({@link useCreateViewState} + `<JBrowseLinearGenomeView>`, or
 * `createLinearGenomeView`, which owns the whole lifecycle) and hand it to
 * `destroyViewState` when they let go of it.
 */
const LinearGenomeView = observer(function LinearGenomeView({
  init,
  ref,
  ...rest
}: LinearGenomeViewProps) {
  const [state] = useState(() =>
    createViewState({
      ...rest,
      // with no init, createViewState shows the import form. otherwise wrap
      // init in the session the view expects, filling in the configured
      // assembly name so callers never repeat it
      defaultSession: init
        ? {
            name: `New session ${new Date().toLocaleString()}`,
            view: {
              type: 'LinearGenomeView',
              init: { ...init, assembly: rest.assembly.name },
            },
          }
        : undefined,
    }),
  )

  useImperativeHandle(ref, () => state, [state])

  return <JBrowseLinearGenomeView viewState={state} />
})

export default LinearGenomeView
