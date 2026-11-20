import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

const useStyles = makeStyles()({
  name: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
})

const TrackNameText = observer(function TrackNameText({
  name,
}: {
  name: string
}) {
  const { classes } = useStyles()
  return (
    <span data-clip className={classes.name}>
      <SanitizedHTML html={name} />
    </span>
  )
})

export default TrackNameText
