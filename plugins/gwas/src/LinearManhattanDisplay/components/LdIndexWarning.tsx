import { makeStyles } from '@jbrowse/core/util/tss-react'

const useStyles = makeStyles()({
  container: {
    position: 'absolute',
    left: 4,
    background: 'rgba(255,243,205,0.95)',
    border: '1px solid #e0c265',
    borderRadius: 3,
    padding: '2px 6px',
    fontSize: 11,
    pointerEvents: 'none',
  },
})

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
