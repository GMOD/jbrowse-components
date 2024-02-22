import React, { Suspense } from 'react'
import { observer } from 'mobx-react'

// locals
import { SessionWithDrawerWidgets } from '@jbrowse/core/util'

const DialogQueue = observer(function ({
  session,
}: {
  session: SessionWithDrawerWidgets
}) {
  const { DialogComponent, DialogProps } = session
  return (
    <>
      {DialogComponent ? (
        <Suspense fallback={null}>
          <DialogComponent {...DialogProps} />
        </Suspense>
      ) : null}
    </>
  )
})

export default DialogQueue
