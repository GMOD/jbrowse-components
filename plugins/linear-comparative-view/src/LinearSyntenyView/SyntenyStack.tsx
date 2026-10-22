import { Fragment } from 'react'

import { useWidthSetter } from '@jbrowse/core/util/hooks'
import { TrackStack, ViewStatus } from '@jbrowse/display-ui/embed'
import { observer } from 'mobx-react'

import { SyntenyLevel } from '../LinearSyntenyViewHelper/SyntenyLevel.tsx'

import type { LinearSyntenyViewModel } from './model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type React from 'react'

/**
 * #api
 * A synteny view drawn without its Material UI chrome: each row, with a ribbon
 * band between neighbours, or the view's status until it is ready. The
 * bring-your-own counterpart of `TrackStack` from `@jbrowse/display-ui/embed`.
 *
 * Each row is an ordinary linear genome view, drawn by `renderRow`, which
 * defaults to a `TrackStack`:
 *
 * ```tsx
 * <SyntenyStack
 *   view={view}
 *   renderRow={row => (
 *     <TrackStack view={row}>{row.assemblyNames[0]}</TrackStack>
 *   )}
 * />
 * ```
 */
export const SyntenyStack = observer(function SyntenyStack({
  view,
  renderRow = row => <TrackStack view={row} />,
  style,
}: {
  view: LinearSyntenyViewModel
  renderRow?: (row: LinearGenomeViewModel, index: number) => React.ReactNode
  style?: React.CSSProperties
}) {
  const ref = useWidthSetter(view)
  return (
    <div ref={ref} style={style}>
      {view.status.type === 'ready' ? (
        view.views.map((row, i) => {
          const level = i > 0 ? view.levels[i - 1] : undefined
          return (
            <Fragment key={row.id}>
              {level ? <SyntenyLevel key={level.id} level={level} /> : null}
              {renderRow(row, i)}
            </Fragment>
          )
        })
      ) : (
        <ViewStatus view={view} />
      )}
    </div>
  )
})
