import React, { lazy, Suspense } from 'react'
import { render } from 'react-dom'
import Loading from './components/Loading'

const Main = lazy(() => import('./components/Loader'))
const initialTimeStamp = Date.now()

if (window?.name.startsWith('JBrowseAuthWindow')) {
  const parent = window.opener
  if (parent) {
    parent.postMessage({
      name: window.name,
      redirectUri: window.location.href,
    })
  }
  window.close()
}
const rootElement = document.getElementById('root')

render(
  <Suspense fallback={<Loading />}>
    <Main initialTimestamp={initialTimeStamp} />
  </Suspense>,
  rootElement,
)
