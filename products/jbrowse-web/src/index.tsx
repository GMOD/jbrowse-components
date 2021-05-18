import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom'

// @ts-ignore
import Loading from './Loading'
import * as serviceWorker from './serviceWorker'

// this is the main process, so start and register our service worker and web workers
serviceWorker.register()

// avoid using react-error-overlay, which can cause 100% cpu from doing regex
// on large error messages, but this currently breaks hot module reloading
// https://github.com/facebook/create-react-app/issues/10611
if (process.env.NODE_ENV === 'development') {
  // @ts-ignore uses dynamic import to avoid bundling package into production
  import('react-error-overlay').then(m => {
    m.stopReportingRuntimeErrors()
  })
}

const Main = lazy(() => import('./Loader'))
const initialTimeStamp = Date.now()
ReactDOM.render(
  <Suspense fallback={<Loading />}>
    <Main initialTimestamp={initialTimeStamp} />
  </Suspense>,
  document.getElementById('root'),
)
