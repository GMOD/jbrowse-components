import React from 'react'

import createCache from '@emotion/cache'
import { CacheProvider } from '@emotion/react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'

// Deliberately not re-exported from the `util` barrel: it is the barrel's only
// reason to pull react/react-dom/@emotion, and the barrel is imported by
// worker-side adapter code that never renders.
//
// https://react.dev/reference/react-dom/server/renderToString#removing-rendertostring-from-the-client-code
export function renderToStaticMarkup(node: React.ReactElement) {
  const div = document.createElement('div')
  // makeStyles components (via __unsafe_useEmotionCache) need an emotion cache
  // in context. The browser has an ambient default cache, but node/jsdom (e.g.
  // jbrowse-img) loads @emotion/react before `document` exists, so its default
  // cache context is null — provide one explicitly here.
  const cache = createCache({ key: 'css' })
  // eslint-disable-next-line @eslint-react/dom-no-flush-sync
  flushSync(() => {
    createRoot(div).render(
      React.createElement(CacheProvider, { value: cache }, node),
    )
  })
  return div.innerHTML.replaceAll(/\brgba\((.+?),[^,]+?\)/g, 'rgb($1)')
}
