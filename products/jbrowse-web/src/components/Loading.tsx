import { CircularProgress } from '@mui/material'
import { observer } from 'mobx-react'

import { useBootShell } from '../bootShell.ts'

const Loading = observer(function Loading() {
  return useBootShell() ? null : (
    <CircularProgress
      disableShrink
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        marginTop: -25,
        marginLeft: -25,
      }}
      size={50}
    />
  )
})

export default Loading
