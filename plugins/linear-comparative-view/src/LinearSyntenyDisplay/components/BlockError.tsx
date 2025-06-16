import { makeStyles } from 'tss-react/mui'

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
