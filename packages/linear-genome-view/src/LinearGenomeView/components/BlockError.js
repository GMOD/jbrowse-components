import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React from 'react'

const useStyles = makeStyles({
  blockError: {
    display: 'block',
    color: 'red',
    width: '30em',
    wordWrap: 'normal',
    whiteSpace: 'normal',
  },
})

function Error({ error }) {
  const classes = useStyles()
  return <div className={classes.blockError}>{error.message}</div>
}
Error.propTypes = {
  error: MobxPropTypes.objectOrObservableObject.isRequired,
}

const ErrorMessage = observer(Error)
export default ErrorMessage
