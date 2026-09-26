import { makeStyles } from '@jbrowse/core/util/tss-react'

const useStyles = makeStyles()(theme => ({
  container: {
    position: 'absolute',
    left: 4,
    color: theme.palette.text.primary,
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.warning.main}`,
    borderRadius: 3,
    padding: '2px 6px',
    fontSize: 11,
    pointerEvents: 'none',
  },
}))

export default function LdIndexWarning({ offsetTop }: { offsetTop: number }) {
  const { classes } = useStyles()
  return (
    <div className={classes.container} style={{ top: offsetTop + 2 }}>
      No point has LD data to the index SNP — every other point is grey. Check
      that the LD file covers the index SNP and that the assembly's aliases
      cover its reference names (e.g. “chr2” vs “2”).
    </div>
  )
}
