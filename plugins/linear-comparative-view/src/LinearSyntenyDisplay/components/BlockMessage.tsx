import { makeStyles } from '@jbrowse/core/util/tss-react'

const useStyles = makeStyles()({
  blockMessage: {
    background: '#f1f1f1',
    padding: 10,
  },
})

export default function BlockMessage({
  messageText,
  error,
}: {
  messageText: string
  error?: boolean
}) {
  const { classes } = useStyles()
  return (
    <div
      className={classes.blockMessage}
      style={{ color: error ? 'red' : undefined }}
    >
      {messageText}
    </div>
  )
}
