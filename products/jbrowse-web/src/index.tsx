import React, { lazy, Suspense } from 'react'
import { render } from 'react-dom'
import Loading from './Loading'

const Main = lazy(() => import('./Loader'))
const initialTimeStamp = Date.now()

// this should be able to be removed after @mui/x-data-grid updates
// window.addEventListener('error', event => {
//   console.log(event.message, event.message.match(/ResizeObserver/))
//   event.preventDefault()
//   event.stopPropagation()
//   event.stopImmediatePropagation()
// })

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
