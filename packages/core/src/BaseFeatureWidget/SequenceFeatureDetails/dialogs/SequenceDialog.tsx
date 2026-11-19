import { observer } from 'mobx-react'

import { InfoDialog } from '../../../ui/index.ts'
import { makeStyles } from '../../../util/tss-react/index.ts'

import type { SimpleFeatureSerialized } from '../../../util/index.ts'
import type { ReactNode } from 'react'

const useStyles = makeStyles()({
  content: {
    width: '80em',
  },
})

const SequenceDialog = observer(function SequenceDialog({
  feature,
  handleClose,
  children,
}: {
  feature: SimpleFeatureSerialized | undefined
  handleClose: () => void
  children: ReactNode
}) {
  const { classes } = useStyles()
  return (
    <InfoDialog
      maxWidth="xl"
      open
      title={
        feature
          ? `Feature sequence - ${feature.name || feature.id || feature.type}`
          : 'Feature sequence'
      }
      onClose={() => {
        handleClose()
      }}
    >
      <div className={classes.content}>{children}</div>
    </InfoDialog>
  )
})

export default SequenceDialog
