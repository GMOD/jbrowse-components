import { memo } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import { INTERNAL_SOURCE_KEYS } from '../constants.ts'

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
    [key: string]: unknown
  }
  x: number
  y: number
}) {
  const { classes } = useStyles()

  return (
    <BaseTooltip clientPoint={{ x, y }}>
      {source.name ? (
        <div className={classes.header}>
          {source.color ? (
            <div
              className={classes.colorBox}
              style={{ backgroundColor: source.color }}
            />
          ) : null}
          <b>{source.name}</b>
        </div>
      ) : null}
      <table className={classes.table}>
        <tbody>
          {Object.entries(source).map(([key, value]) =>
            !INTERNAL_SOURCE_KEYS.has(key) && value !== undefined ? (
              <tr key={key}>
                <td className={classes.keyCell}>{key}</td>
                <td className={classes.valueCell}>{String(value)}</td>
              </tr>
            ) : null,
          )}
        </tbody>
      </table>
    </BaseTooltip>
  )
})

export default MultiSampleVariantTooltip
