import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom'
import Loading from './Loading'
import * as serviceWorker from './serviceWorker'
// this is the main process, so start and register our service worker and web workers
serviceWorker.register()

const Main = lazy(() => import('./Loader'))
const initialTimeStamp = Date.now()
ReactDOM.render(
  <Suspense fallback={<Loading />}>
    <Main initialTimestamp={initialTimeStamp} />
  </Suspense>,
  document.getElementById('root'),
)
