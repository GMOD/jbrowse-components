import { forwardRef, useImperativeHandle, useState } from 'react'

import { observer } from 'mobx-react'

import JBrowseCircularGenomeView from '../JBrowseCircularGenomeView/index.ts'
import createViewState from '../createViewState.ts'

import type { ViewModel } from '../createModel/createModel.ts'
import type { CreateViewStateBaseOptions } from '../createViewState.ts'
import type { CircularViewInit } from '@jbrowse/plugin-circular-view'

export interface CircularGenomeViewProps extends CreateViewStateBaseOptions {
  // declarative description of what to show initially: { assembly, tracks }.
  // this is the view's own `init` shape, so the same blob round-trips through
  // saved sessions and URL specs
  init?: CircularViewInit
}

/**
 * Uncontrolled, prop-driven wrapper around the `viewState`-based
 * {@link JBrowseCircularGenomeView}. Props are initial values (like an input's
 * `defaultValue`): the engine is constructed once and later prop changes are
 * ignored. To swap assembly/plugins, remount via React `key`.
 *
 * `init` is the declarative input; for imperative control after launch
 * (showTrack, onPatch, ...) take a `ref` to the live engine.
 */
const CircularGenomeView = observer(
  forwardRef<ViewModel, CircularGenomeViewProps>(function CircularGenomeView(
    props,
    ref,
  ) {
    const { init, ...rest } = props

    const [state] = useState(() =>
      createViewState({
        ...rest,
        // `init` is the single initial-state mechanism; wrap it in the session
        // the view expects. with no init, createViewState shows the import form
        defaultSession: init
          ? { name: 'this session', view: { type: 'CircularView', init } }
          : undefined,
      }),
    )

    useImperativeHandle(ref, () => state, [state])

    return <JBrowseCircularGenomeView viewState={state} />
  }),
)

export default CircularGenomeView
