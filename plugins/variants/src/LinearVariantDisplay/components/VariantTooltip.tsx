import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

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
  // wraps, since BaseTooltip caps the box at 300px and a nowrap value runs
  // past its edge: a record's carriers line is longer than that
  valueCell: {
    whiteSpace: 'normal',
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

const VariantTooltip = observer(function VariantTooltip({
  source,
  x,
  y,
}: {
  source: {
    rowColor?: string
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
  const rows = getTooltipRows(source)

  // a record whose band labels say everything has nothing left to show, as a
  // feature track's tooltip drops what its labels say
  return heading || rows.length > 0 ? (
    <BaseTooltip clientPoint={{ x, y }}>
      {heading ? (
        <div className={classes.header}>
          {source.rowColor ? (
            <div
              className={classes.colorBox}
              style={{ backgroundColor: source.rowColor }}
            />
          ) : null}
          <b>{heading}</b>
        </div>
      ) : null}
      <table className={classes.table}>
        <tbody>
          {rows.map(({ key, label, value }) => (
            <tr key={key}>
              <td className={classes.keyCell}>{label}</td>
              <td className={classes.valueCell}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </BaseTooltip>
  ) : null
})

export default VariantTooltip
