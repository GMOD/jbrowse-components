import React from 'react'
import { makeStyles } from '@material-ui/core'

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

  let str = `${error}`
  let snapshotError = ''

  // best effort to make a better error message than the default
  // mobx-state-tree
  const match = str.match(/.*at path "(.*)" snapshot `(.*)` is not assignable/)
  if (match) {
    str = `Failed to load element at ${match[1]}`
    snapshotError = match[2]
  }
  return (
    <div className={classes.message}>
      {str.slice(0, 10000)}
      {snapshotError ? (
        <div>
          ... Failed element had snapshot:
          <pre className={classes.errorBox}>
            {JSON.stringify(JSON.parse(snapshotError), null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  )
}

export default ErrorMessage
