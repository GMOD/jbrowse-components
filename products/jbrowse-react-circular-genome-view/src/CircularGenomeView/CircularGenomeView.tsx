import { useImperativeHandle, useState } from 'react'
import type { Ref } from 'react'

import { observer } from 'mobx-react'

import JBrowseCircularGenomeView from '../JBrowseCircularGenomeView/index.ts'
import createViewState from '../createViewState.ts'

import type { ViewModel } from '../createModel/createModel.ts'
import type { CreateViewStateBaseOptions } from '../createViewState.ts'
import type { CircularViewInit } from '@jbrowse/plugin-circular-view'

export interface CircularGenomeViewProps extends CreateViewStateBaseOptions {
  // declarative description of the initial view: optional tracks to show.
  // mirrors the view's own `init` shape (minus `assembly`, which is taken from
  // the `assembly` prop), so the same blob round-trips through saved sessions
  // and URL specs. pass `init={{}}` to open the configured assembly with no
  // extra tracks
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
 */
const CircularGenomeView = observer(function CircularGenomeView({
  init,
  ref,
  ...rest
}: CircularGenomeViewProps) {
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
