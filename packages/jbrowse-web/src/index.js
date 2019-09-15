import React from 'react'
import ReactDOM from 'react-dom'
import JBrowse from './JBrowse'
import * as serviceWorker from './serviceWorker'
import 'core-js/stable'

let app = <JBrowse config={{ uri: 'test_data/config.json' }} />

// TODO: get rid of user agent detection
// https://developer.mozilla.org/en-US/docs/Web/HTTP/Browser_detection_using_the_user_agent
if (window.chrome)
  // this is the main process, so start and register our service worker and web workers
  serviceWorker.register()
else
  app = (
    <div>
      <h1>This browser is not supported</h1>
      <p>
        JBrowse 2 is still in development and doesn't support all modern
        browsers yet. Browsers that do currently work include:
      </p>
      <ul>
        <li>Chrome</li>
        <li>Chromium</li>
        <li>Opera</li>
      </ul>
    </div>
  )

ReactDOM.render(app, document.getElementById('root'))
