import React from 'react'

import createCache from '@emotion/cache'
import { CacheProvider } from '@emotion/react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'

// Deliberately not re-exported from the `util` barrel: it is the barrel's only
// reason to pull react/react-dom/@emotion, and the barrel is imported by
// worker-side adapter code that never renders.
//
// It is not part of the plugin ABI either, and that removal did break two
// published bundles before anyone noticed: react-msaview's SVG export read it
// off `@jbrowse/core/util`, and jbrowse-plugin-msaview and -tview bundle
// react-msaview. Resolved on their side -- react-msaview owns its own copy now
// (packages/lib/src/renderToStaticMarkup.ts there) -- because a rendering
// library asking its host for a renderer was the coupling worth removing, and
// because react-dom is a host external for a plugin anyway, so it costs them a
// few hundred bytes rather than a duplicate react. Re-exporting it from the
// barrel would also stub `@jbrowse/core/util` in the worker, since the
// generator stubs a module whose graph reaches react-dom; workerModules.test.ts
// fails on that.
//
// https://react.dev/reference/react-dom/server/renderToString#removing-rendertostring-from-the-client-code
export function renderToStaticMarkup(node: React.ReactElement) {
  const div = document.createElement('div')
  // makeStyles components (via __unsafe_useEmotionCache) need an emotion cache
  // in context. The browser has an ambient default cache, but node/jsdom (e.g.
  // jbrowse-img) loads @emotion/react before `document` exists, so its default
  // cache context is null — provide one explicitly here.
  const cache = createCache({ key: 'css' })
  // a client root reports a render error and unmounts, so without this the
  // export is an empty string its caller writes as a file
  const uncaught: unknown[] = []
  const root = createRoot(div, {
    onUncaughtError: error => {
      uncaught.push(error)
    },
  })
  let html: string
  try {
    // eslint-disable-next-line @eslint-react/dom-no-flush-sync
    flushSync(() => {
      root.render(React.createElement(CacheProvider, { value: cache }, node))
    })
    if (uncaught.length > 0) {
      throw uncaught[0]
    }
    html = div.innerHTML
  } finally {
    // This is a *real* client root, not a server render: its effects run, so
    // every `observer` in the tree ends up with a live MobX reaction. Leaving
    // the root mounted therefore keeps the whole detached export tree — and an
    // SVG export of a full view is tens of thousands of nodes — subscribed to
    // the session's models for the rest of the session, re-rendering it into a
    // dead <div> on every pan and zoom, once per export ever taken. Unmount
    // once the markup is a string, which no longer depends on the DOM.
    root.unmount()
  }
  return html
}
