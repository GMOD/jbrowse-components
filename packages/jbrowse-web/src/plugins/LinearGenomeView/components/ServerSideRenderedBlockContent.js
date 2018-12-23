import React from 'react'
import { observer, PropTypes } from 'mobx-react'
import { setLivelinessChecking } from 'mobx-state-tree'
import ServerSideRenderedContent from './ServerSideRenderedContent'

setLivelinessChecking('error')

function LoadingMessage() {
  return <div className="loading">Loading ...</div>
}

function ErrorMessage({ error }) {
  return <div className="error">{error.message}</div>
}
ErrorMessage.propTypes = {
  error: PropTypes.objectOrObservableObject.isRequired,
}

const ServerSideRenderedBlockContent = observer(({ model }) => {
  if (model.error) return <ErrorMessage error={model.error} />
  if (!model.filled) return <LoadingMessage />
  return <ServerSideRenderedContent model={model} />
})

export default ServerSideRenderedBlockContent
