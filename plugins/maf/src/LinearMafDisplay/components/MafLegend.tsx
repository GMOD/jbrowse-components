import { makeStyles } from '@jbrowse/core/util/tss-react'

export interface LegendEntry {
  label: string
  /** swatch color; omit for a plain text entry (e.g. an overflow count) */
  color?: string
}

const useStyles = makeStyles()(theme => ({
  legend: {
    position: 'absolute',
    top: 2,
    right: 2,
    zIndex: 3,
    pointerEvents: 'none',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    maxWidth: '45%',
    padding: '2px 4px',
    borderRadius: 3,
    fontSize: theme.typography.fontSize * 0.8,
    background: theme.palette.background.paper,
    opacity: 0.9,
    border: `1px solid ${theme.palette.divider}`,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    whiteSpace: 'nowrap',
  },
  swatch: {
    width: 9,
    height: 9,
    borderRadius: 2,
    flexShrink: 0,
  },
}))

/**
 * Compact top-right legend overlay shared by the MAF rendering modes (codon
 * change categories, source-chromosome colors). Pure presentational: the caller
 * supplies the entries. Renders nothing for an empty list.
 */
export default function MafLegend({ entries }: { entries: LegendEntry[] }) {
  const { classes } = useStyles()
  if (entries.length === 0) {
    return null
  }
  return (
    <div className={classes.legend}>
      {entries.map(({ label, color }) => (
        <div key={label} className={classes.item}>
          {color ? (
            <span className={classes.swatch} style={{ background: color }} />
          ) : null}
          {label}
        </div>
      ))}
    </div>
  )
}
