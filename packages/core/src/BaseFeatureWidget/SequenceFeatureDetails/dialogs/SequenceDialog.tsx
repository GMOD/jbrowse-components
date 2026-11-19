import { observer } from 'mobx-react'

import { InfoDialog } from '../../../ui/index.ts'
import { makeStyles } from '../../../util/tss-react/index.ts'

import type { ReactNode } from 'react'

const useStyles = makeStyles()({
  content: {
    width: '80em',
  },
})

const SequenceDialog = observer(function SequenceDialog({
  title,
  handleClose,
  children,
}: {
  title: string
  handleClose: () => void
  children: ReactNode
}) {
  const { classes } = useStyles()
  return (
    <InfoDialog
      maxWidth="xl"
      open
      title={title}
      onClose={() => {
        handleClose()
      }}
    >
      <div className={classes.content}>{children}</div>
    </InfoDialog>
  )
})

export default SequenceDialog
