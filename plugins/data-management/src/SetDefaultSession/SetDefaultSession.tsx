import React from 'react'
import { observer } from 'mobx-react'
import Dialog from '@material-ui/core/Dialog'

const SetDefaultSession = observer(({ open }: { open: boolean }) => {
  return <Dialog open={open}>Set default session</Dialog>
})

export default SetDefaultSession
