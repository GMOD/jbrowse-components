import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom'
import Loading from './Loading'

const Main = lazy(() => import('./Loader'))
const initialTimeStamp = Date.now()

// pull query string out, can check for specific query param

// Pop-up logic for OAuth Flow
// if urlParams.has('access_token')
// check how many keys, if no keys try getting rid of hash
if (window && window.location.href.includes('access_token')) {
  const fixedQueryString = window.location.href.replace('#', '?')
  const queryStringSearch = new URL(fixedQueryString).search
  const urlParams = new URLSearchParams(queryStringSearch)
  const token = urlParams.get('access_token')
  const expireTime = urlParams.get('expires_in')
  const parent = window.opener
  if (token && parent) {
    parent.postMessage(
      { token: token, expireTime: expireTime },
      parent.location.origin,
    )
    window.close()
  }
}

if (window && window.location.href.includes('code')) {
  const queryString = window.location.search
  const urlParams = new URLSearchParams(queryString)
  const code = urlParams.get('code')
  const parent = window.opener
  if (code && parent) {
    parent.postMessage({ code: code }, parent.location.origin)
    window.close()
  }
}

// TODOAUTH prob need a better condition to close a failed auth loop
if (window && window.location.href.includes('access_denied')) {
  window.close()
}

ReactDOM.render(
  <Suspense fallback={<Loading />}>
    <Main initialTimestamp={initialTimeStamp} />
  </Suspense>,
  document.getElementById('root'),
)
