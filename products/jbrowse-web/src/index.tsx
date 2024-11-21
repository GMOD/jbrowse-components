import React, { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import Loading from './components/Loading'

// eslint-disable-next-line react-refresh/only-export-components
const Main = lazy(() => import('./components/Loader'))

const initialTimeStamp = Date.now()

if (window.name.startsWith('JBrowseAuthWindow')) {
  const parent = window.opener
  if (parent) {
    parent.postMessage({
      name: window.name,
      redirectUri: window.location.href,
    })
  }
  window.close()
}

const root = createRoot(document.getElementById('root')!)

root.render(
  <React.StrictMode>
    <Suspense fallback={<Loading />}>
      <Main initialTimestamp={initialTimeStamp} />
    </Suspense>
  </React.StrictMode>,
)
