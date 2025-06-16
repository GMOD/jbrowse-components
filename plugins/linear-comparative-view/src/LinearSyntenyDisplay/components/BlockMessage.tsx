import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()(theme => {
  const bg = theme.palette.action.disabledBackground
  return {
    loading: {
      paddingLeft: '0.6em',
      backgroundColor: theme.palette.background.default,
      backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 5px, ${bg} 5px, ${bg} 10px)`,
      textAlign: 'center',
    },
    blockMessage: {
      background: '#f1f1f1',
      padding: 10,
    },
  }
})

export default function BlockMessage({ messageText }: { messageText: string }) {
  const { classes } = useStyles()
  return <div className={classes.blockMessage}>{messageText}</div>
}
