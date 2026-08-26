import { renderToString } from 'react-dom/server'

import { App } from './app.jsx'

export function render(data) {
  return renderToString(<App data={data} />)
}
