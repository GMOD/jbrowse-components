import { withStyles } from '@material-ui/core'
import React from 'react'
import { observer, PropTypes } from 'mobx-react'
import { setLivelinessChecking } from 'mobx-state-tree'
import ServerSideRenderedContent from './ServerSideRenderedContent'

setLivelinessChecking('error')

const styles = {
  loading: {
    color: 'gray',
    paddingLeft: '0.6em',
  },
  error: {
    display: 'block',
    color: 'red',
    width: '30em',
    wordWrap: 'normal',
    whiteSpace: 'normal',
  },
}

const LoadingMessage = withStyles(styles)(classes => (
  <div className={classes.loading}>Loading ...</div>
))

const ErrorMessage = withStyles(styles)(({ error, classes }) => (
  <div className={classes.error}>{error.message}</div>
))
ErrorMessage.propTypes = {
  error: PropTypes.objectOrObservableObject.isRequired,
}

const ServerSideRenderedBlockContent = observer(({ model }) => {
  if (model.error) return <ErrorMessage error={model.error} />
  if (!model.filled) return <LoadingMessage />
  return <ServerSideRenderedContent model={model} />
})

export default ServerSideRenderedBlockContent
