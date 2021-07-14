import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom'
import Loading from './Loading'

const Main = lazy(() => import('./Loader'))
const initialTimeStamp = Date.now()

if (window && window.name.startsWith('JBrowseAuthWindow')) {
  const parent = window.opener
  if (parent) {
    parent.postMessage({
      name: window.name,
      redirectUri: window.location.href,
    })
  }
  window.close()
}

ReactDOM.render(
  <Suspense fallback={<Loading />}>
    <Main initialTimestamp={initialTimeStamp} />
  </Suspense>,
  document.getElementById('root'),
)
