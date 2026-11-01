import { Suspense } from 'react'

import { getSession } from '@jbrowse/core/util'
import {
  VIEW_HEADER_HEIGHT_VAR,
  useWidthSetter,
} from '@jbrowse/core/util/hooks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'

const useStyles = makeStyles()(theme => ({
  viewContainer: {
    width: '100%',
    // clip (not hidden) so sticky descendant headers keep working
    overflow: 'clip',
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    // no title bar above the view, so the sticky chrome that clears one pins
    // at the top edge
    [VIEW_HEADER_HEIGHT_VAR]: '0px',
  },
}))

const ViewContainer = observer(function ViewContainer({
  view,
  children,
}: {
  view: IBaseViewModel
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  const session = getSession(view)
  const ref = useWidthSetter(view)

  return (
    <div ref={ref} className={classes.viewContainer}>
      {session.DialogComponent ? (
        <Suspense fallback={null}>
          <session.DialogComponent {...session.DialogProps} />
        </Suspense>
      ) : null}
      {children}
    </div>
  )
})

export default ViewContainer
