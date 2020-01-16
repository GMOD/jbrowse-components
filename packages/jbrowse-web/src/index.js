import React from 'react'
import ReactDOM from 'react-dom'
import { useQueryParam, StringParam } from 'use-query-params'
import { TextDecoder, TextEncoder } from 'fastestsmallesttextencoderdecoder'
import JBrowse from './JBrowse'
import * as serviceWorker from './serviceWorker'
import 'requestidlecallback-polyfill'
import 'core-js/stable'

if (!window.TextEncoder) window.TextEncoder = TextEncoder
if (!window.TextDecoder) window.TextDecoder = TextDecoder

const App = () => {
  const [config] = useQueryParam('config', StringParam)
  return <JBrowse config={{ uri: config || 'test_data/config.json' }} />
}
const Unsupported = () => (
  <div>
    <h1>This browser is not supported</h1>
    <p>
      JBrowse 2 is still in development and doesn't support all modern browsers
      yet. Browsers that do currently work include:
    </p>
    <ul>
      <li>
        <a
          href="https://www.google.com/chrome/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Chrome
        </a>
      </li>
      <li>
        <a
          href="https://www.chromium.org/Home"
          target="_blank"
          rel="noopener noreferrer"
        >
          Chromium
        </a>
      </li>
      <li>
        <a
          href="https://www.opera.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Opera
        </a>
      </li>
      <li>
        <a
          href="https://www.microsoft.com/en-us/edge"
          target="_blank"
          rel="noopener noreferrer"
        >
          new Microsoft Edge
        </a>
      </li>
    </ul>
  </div>
)

// If it has OffscreenCanvas, it probably has the other things we need
const hasOffscreenCanvas = typeof OffscreenCanvas === 'function'

if (hasOffscreenCanvas) {
  // this is the main process, so start and register our service worker and web workers
  serviceWorker.register()
}

ReactDOM.render(
  hasOffscreenCanvas ? <App /> : <Unsupported />,
  document.getElementById('root'),
)
