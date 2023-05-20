import React, { Suspense } from 'react'
import { observer } from 'mobx-react'

// locals
import { SessionWithDrawerWidgets } from '@jbrowse/core/util'

export default observer(function ({
  session,
}: {
  session: SessionWithDrawerWidgets
}) {
  const { DialogComponent, DialogProps } = session
  return (
    <>
      {DialogComponent ? (
        <Suspense fallback={<React.Fragment />}>
          <DialogComponent {...DialogProps} />
        </Suspense>
      ) : null}
    </>
  )
})
