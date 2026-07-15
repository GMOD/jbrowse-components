import { memo } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import { getTooltipRows } from './getTooltipRows.ts'

const useStyles = makeStyles()({
  table: {
    borderCollapse: 'collapse',
  },
  keyCell: {
    whiteSpace: 'nowrap',
    paddingRight: 8,
    fontWeight: 'bold',
    verticalAlign: 'top',
  },
  valueCell: {
    whiteSpace: 'nowrap',
  },
  colorBox: {
    width: 10,
    height: 10,
    display: 'inline-block',
    marginRight: 4,
    verticalAlign: 'middle',
  },
  header: {
    whiteSpace: 'nowrap',
    paddingBottom: 2,
    textAlign: 'center',
  },
})

const MultiSampleVariantTooltip = memo(function MultiSampleVariantTooltip({
  source,
  x,
  y,
}: {
  source: {
    color?: string
    name?: string
    label?: string
    [key: string]: unknown
  }
  x: number
  y: number
}) {
  const { classes } = useStyles()
  // Prefer the friendly display override, matching the sidebar legend
  // (label ?? name); `name` is the stable hit-test identity.
  const heading = source.label ?? source.name

  return (
    <BaseTooltip clientPoint={{ x, y }}>
      {heading ? (
        <div className={classes.header}>
          {source.color ? (
            <div
              className={classes.colorBox}
              style={{ backgroundColor: source.color }}
            />
          ) : null}
          <b>{heading}</b>
        </div>
      ) : null}
      <table className={classes.table}>
        <tbody>
          {getTooltipRows(source).map(({ key, label, value }) => (
            <tr key={key}>
              <td className={classes.keyCell}>{label}</td>
              <td className={classes.valueCell}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </BaseTooltip>
  )
})

export default MultiSampleVariantTooltip
