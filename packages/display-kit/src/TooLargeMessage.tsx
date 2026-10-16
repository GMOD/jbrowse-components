import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import BlockMsg from './BlockMsg.tsx'

import type { TooLargeProps } from '@jbrowse/display-ui'

const TooLargeMessage = observer(function TooLargeMessage({
  message,
  onForceLoad,
}: TooLargeProps) {
  return (
    <BlockMsg
      severity="warning"
      action={<Button onClick={onForceLoad}>Force load</Button>}
      message={message}
    />
  )
})

export default TooLargeMessage
