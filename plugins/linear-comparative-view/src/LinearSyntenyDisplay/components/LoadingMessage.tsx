import { LoadingEllipses } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'

const useStyles = makeStyles()(theme => {
  const bg = theme.palette.action.disabledBackground
  return {
    loading: {
      paddingLeft: '0.6em',
      backgroundColor: theme.palette.background.default,
      backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 5px, ${bg} 5px, ${bg} 10px)`,
      textAlign: 'center',
    },
  }
})

export default function LoadingMessage({ message }: { message?: string }) {
  const { classes } = useStyles()

  return (
    <div className={classes.loading}>
      <LoadingEllipses message={message} />
    </div>
  )
}
