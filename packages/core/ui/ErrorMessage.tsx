import React from 'react'
import { makeStyles } from '@mui/material'

const useStyles = makeStyles(theme => ({
  message: {
    border: '1px solid black',
    background: '#f88',
    overflow: 'auto',
    maxHeight: 200,
    margin: theme.spacing(1),
    padding: theme.spacing(1),
  },

  errorBox: {
    background: 'lightgrey',
    border: '1px solid black',
    margin: 20,
  },
}))
const ErrorMessage = ({ error }: { error: unknown }) => {
  const classes = useStyles()

  let snapshotError = ''
  let str = `${error}`
  const findStr = 'is not assignable'
  const idx = str.indexOf(findStr)
  if (idx !== -1) {
    const trim = str.slice(0, idx + findStr.length)
    // best effort to make a better error message than the default
    // mobx-state-tree

    // case 1. element has a path
    const match = trim.match(
      /.*at path "(.*)" snapshot `(.*)` is not assignable/m,
    )
    if (match) {
      str = `Failed to load element at ${match[1]}...Failed element had snapshot`
      snapshotError = match[2]
    }

    // case 2. element has no path
    const match2 = trim.match(/.*snapshot `(.*)` is not assignable/)
    if (match2) {
      str = `Failed to load element...Failed element had snapshot`
      snapshotError = match2[1]
    }
  }
  return (
    <div className={classes.message}>
      {str.slice(0, 10000)}
      {snapshotError ? (
        <pre className={classes.errorBox}>
          {JSON.stringify(JSON.parse(snapshotError), null, 2)}
        </pre>
      ) : null}
    </div>
  )
}

export default ErrorMessage
