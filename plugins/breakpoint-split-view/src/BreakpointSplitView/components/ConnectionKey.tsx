import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import SvgColorLegend from '@jbrowse/core/ui/SvgColorLegend'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { drawnConnectionKeySections } from './overlayUtils.tsx'

import type { BreakpointViewModel } from '../model.ts'
import type { drawnConnectionKey } from './overlayUtils.tsx'

const useStyles = makeStyles()(theme => ({
  key: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '2px 12px',
    marginLeft: 'auto',
    paddingRight: 4,
    fontSize: 11,
  },
  section: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '2px 10px',
    '&:not(:first-of-type)': {
      paddingLeft: 12,
      borderLeft: `1px solid ${theme.palette.divider}`,
    },
  },
  title: {
    color: theme.palette.text.secondary,
    fontWeight: 500,
  },
  entry: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    whiteSpace: 'nowrap',
  },
  swatch: {
    width: 10,
    height: 10,
    flexShrink: 0,
    borderRadius: 2,
  },
}))

const ConnectionKey = observer(function ConnectionKey({
  model,
}: {
  model: BreakpointViewModel
}) {
  const { classes } = useStyles()
  const sections = drawnConnectionKeySections(model, usePalette())
  return sections.length > 0 ? (
    <div className={classes.key} data-testid="connection-key">
      {sections.map(({ title, rows }) => (
        <span key={title} className={classes.section}>
          {sections.length > 1 ? (
            <span className={classes.title}>{title}</span>
          ) : null}
          {rows.map(({ key, color, label }) => (
            <span key={key} className={classes.entry}>
              <span className={classes.swatch} style={{ background: color }} />
              {label}
            </span>
          ))}
        </span>
      ))}
    </div>
  ) : null
})

export function SvgConnectionKey({
  rows,
  canvasWidth,
}: {
  rows: ReturnType<typeof drawnConnectionKey>
  canvasWidth: number
}) {
  return (
    <SvgColorLegend
      canvasWidth={canvasWidth}
      testid="connection-key"
      entries={rows}
    />
  )
}

export default ConnectionKey
