import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { getTooltipRows, tooltipHeading } from './getTooltipRows.ts'

import type { TooltipSource } from './getTooltipRows.ts'

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
  source: TooltipSource
  x: number
  y: number
}) {
  const { classes } = useStyles()
  const heading = tooltipHeading(source)
  const rows = getTooltipRows(source)

  // a record whose band labels say everything has nothing left to show, as a
  // feature track's tooltip drops what its labels say
  return heading || rows.length > 0 ? (
    <BaseTooltip clientPoint={{ x, y }}>
      {heading ? (
        <div className={classes.header}>
          {source.sample?.rowColor ? (
            <div
              className={classes.colorBox}
              style={{ backgroundColor: source.sample.rowColor }}
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
              <td className={classes.valueCell}>
                <SanitizedHTML html={value} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </BaseTooltip>
  ) : null
})

export default VariantTooltip
