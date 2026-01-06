import { Suspense } from 'react'

import { observer } from 'mobx-react'

import type { AbstractSessionModel } from '@jbrowse/core/util'

const DialogQueue = observer(function DialogQueue({
  session,
}: {
  session: AbstractSessionModel
}) {
  const { DialogComponent, DialogProps } = session
  return DialogComponent ? (
    <Suspense fallback={null}>
      <DialogComponent {...DialogProps} />
    </Suspense>
  ) : null
})

export default DialogQueue
