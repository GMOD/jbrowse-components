import React from 'react'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()(theme => ({
  table: {
    border: '1px solid #888',
    margin: theme.spacing(4),
    '& td': {
      padding: theme.spacing(1),
    },
  },
}))

export default function ModificationTable({
  modifications,
}: {
  modifications: [string, string | undefined][]
}) {
  const { classes } = useStyles()
  return (
    <table className={classes.table}>
      <tbody>
        {modifications.map(([key, value]) => (
          <tr key={key}>
            <td>{key}</td>
            <td>{value}</td>
            <td
              style={{
                width: '1em',
                background: value,
              }}
            />
          </tr>
        ))}
      </tbody>
    </table>
  )
}
