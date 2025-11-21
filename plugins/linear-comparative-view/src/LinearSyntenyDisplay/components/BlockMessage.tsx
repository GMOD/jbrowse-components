import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
  blockMessage: {
    background: '#f1f1f1',
    padding: 10,
  },
})

export default function BlockMessage({ messageText }: { messageText: string }) {
  const { classes } = useStyles()
  return <div className={classes.blockMessage}>{messageText}</div>
}
