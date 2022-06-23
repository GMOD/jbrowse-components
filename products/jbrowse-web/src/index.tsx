import React, { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import Loading from './Loading'

const Main = lazy(() => import('./Loader'))
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

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const root = createRoot(rootElement!)

root.render(
  <Suspense fallback={<Loading />}>
    <Main initialTimestamp={initialTimeStamp} />
  </Suspense>,
)
