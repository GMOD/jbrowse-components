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

// Shown over the plot when LD coloring is on but the index SNP wasn't found in
// the LD data for the loaded regions, so every point is grey.
export default function LdIndexWarning({ offsetTop }: { offsetTop: number }) {
  const { classes } = useStyles()
  return (
    <div className={classes.container} style={{ top: offsetTop + 2 }}>
      Index SNP not found in the LD data — every point is grey. Check that the
      index SNP is covered by the LD file and that its reference name matches
      (e.g. “chr2” vs “2”).
    </div>
  )
}
