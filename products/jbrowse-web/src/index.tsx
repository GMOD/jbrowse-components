import { StrictMode, Suspense, lazy } from 'react'

import { createRoot } from 'react-dom/client'

import Loading from './components/Loading'

const Main = lazy(() => import('./components/Loader'))

const initialTimeStamp = Date.now()

import './index.css'

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
  <StrictMode>
    <Suspense fallback={<Loading />}>
      <Main initialTimestamp={initialTimeStamp} />
    </Suspense>
  </StrictMode>,
)
