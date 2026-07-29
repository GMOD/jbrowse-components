import { makeStyles } from '@jbrowse/core/util/tss-react'

// MoreHoriz path from @mui/icons-material, inlined to avoid an SvgIcon per row
const moreHorizPath =
  'M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2'

const useStyles = makeStyles()(theme => ({
  icon: {
    width: theme.typography.pxToRem(24),
    height: theme.typography.pxToRem(24),
    display: 'block',
    flexShrink: 0,
    fill: 'currentColor',
  },
}))

export default function MoreHorizGlyph() {
  const { classes } = useStyles()
  return (
    <svg className={classes.icon} viewBox="0 0 24 24" aria-hidden>
      <path d={moreHorizPath} />
    </svg>
  )
}
