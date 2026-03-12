import { LoadingOverlay } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'

const useStyles = makeStyles()({
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
    minHeight: 20,
  },
})

export default function LoadingOverlayContainer({
  statusMessage,
  children,
  height,
}: {
  statusMessage?: string
  children?: React.ReactNode
  height?: number
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.container} style={height ? { height } : undefined}>
      {children}
      <LoadingOverlay
        statusMessage={statusMessage}
        isVisible={!!statusMessage}
      />
    </div>
  )
}
