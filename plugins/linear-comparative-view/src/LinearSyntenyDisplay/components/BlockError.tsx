import { makeStyles } from '@jbrowse/core/util/tss-react'

const useStyles = makeStyles()({
  blockError: {
    background: '#f1f1f1',
    padding: 10,
    color: 'red',
  },
})

export default function BlockError({ error }: { error: unknown }) {
  const { classes } = useStyles()
  return <div className={classes.blockError}>{`${error}`}</div>
}
