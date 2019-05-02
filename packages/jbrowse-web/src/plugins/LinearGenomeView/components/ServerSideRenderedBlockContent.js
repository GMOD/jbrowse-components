import { withStyles } from '@material-ui/core'
import React, { useState, useEffect } from 'react'
import { observer, PropTypes } from 'mobx-react'
import ServerSideRenderedContent from './ServerSideRenderedContent'

const styles = {
  loading: {
    paddingLeft: '0.6em',
    position: 'absolute',
    backgroundColor: "#f1f1f1",
    backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,.5) 5px, rgba(255,255,255,.5) 10px)",
    height: '100%',
    width: '100%',
    textAlign: 'center',
  },
  error: {
    display: 'block',
    color: 'red',
    width: '30em',
    wordWrap: 'normal',
    whiteSpace: 'normal',
  },
}

const LoadingMessage = withStyles(styles)(({classes}) => {

  // only show the loading message after 300ms to prevent excessive flickering
  const [shown, setShown] = useState(false)
  useEffect(() => {
   const timeout = setTimeout(() => setShown(true), 300)
   return () => clearTimeout(timeout)
  })

  return shown ? <div className={classes.loading}>Loading ...</div> : null
})

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
