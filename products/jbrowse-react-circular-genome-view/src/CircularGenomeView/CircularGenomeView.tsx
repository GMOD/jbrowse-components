import { useImperativeHandle, useState } from 'react'

import { observer } from 'mobx-react'

import JBrowseCircularGenomeView from '../JBrowseCircularGenomeView/index.ts'
import createViewState from '../createViewState.ts'

import type { ViewModel } from '../createModel/createModel.ts'
import type { CreateViewStateBaseOptions } from '../createViewState.ts'
import type { CircularViewInit } from '@jbrowse/plugin-circular-view'
import type { Ref } from 'react'

export interface CircularGenomeViewProps extends CreateViewStateBaseOptions {
  // declarative description of the initial view: optional tracks to show.
  // mirrors the view's own `init` shape (minus `assembly`, which is taken from
  // the `assembly` prop), so the same blob round-trips through saved sessions
  // and URL specs. Optional, and `{}` is the same as leaving it off: the
  // configured assembly is drawn either way, so this is how you name tracks to
  // open with it, not how you ask for the genome
  init?: Omit<CircularViewInit, 'assembly'>
  // ref to the live engine, for imperative control after launch (showTrack, ...)
  ref?: Ref<ViewModel>
}

/**
 * Uncontrolled, prop-driven wrapper around the `viewState`-based
 * {@link JBrowseCircularGenomeView}. Props are initial values (like an input's
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
 * ({@link useCreateViewState} + `<JBrowseCircularGenomeView>`) and hand it to
 * `destroyViewState` when they let go of it.
 */
const CircularGenomeView = observer(function CircularGenomeView({
  init,
  ref,
  ...rest
}: CircularGenomeViewProps) {
  const [state] = useState(() =>
    createViewState({
      ...rest,
      // wrap init in the session the view expects, filling in the configured
      // assembly name so callers never repeat it. With no init there is no
      // session to author: createViewState seeds the view's own `init` with
      // the configured assembly, so the whole genome is drawn either way —
      // unlike the linear product, where no init means the import form
      defaultSession: init
        ? {
            name: `New session ${new Date().toLocaleString()}`,
            view: {
              type: 'CircularView',
              init: { ...init, assembly: rest.assembly.name },
            },
          }
        : undefined,
    }),
  )

  useImperativeHandle(ref, () => state, [state])

  return <JBrowseCircularGenomeView viewState={state} />
})

export default CircularGenomeView
