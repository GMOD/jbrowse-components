import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom'
import Loading from './Loading'
import * as serviceWorker from './serviceWorker'
// this is the main process, so start and register our service worker and web workers
serviceWorker.register()

const Main = lazy(() => import('./Loader'))
const initialTimeStamp = Date.now()

// google
if (window && window.location.href.includes('access_token')) {
  const queryString = window.location.search
  const token = window.location.href.split('access_token=')[1]
  const parent = window.opener
  if (token && parent) {
    parent.postMessage({ token: token }, 'http://localhost:3000')
    window.close()
  }
}

// dropbox
if (window && window.location.href.includes('code')) {
  const queryString = window.location.search
  const urlParams = new URLSearchParams(queryString)
  const code = urlParams.get('code')
  const parent = window.opener
  if (code && parent) {
    parent.postMessage({ code: code }, 'http://localhost:3000')
    window.close()
  }
}

ReactDOM.render(
  <Suspense fallback={<Loading />}>
    <Main initialTimestamp={initialTimeStamp} />
  </Suspense>,
  document.getElementById('root'),
)
