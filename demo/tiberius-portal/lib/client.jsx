import { hydrateRoot } from 'react-dom/client'

import { App } from './app.jsx'

const data = JSON.parse(document.getElementById('portal-data').textContent)
hydrateRoot(document.getElementById('root'), <App data={data} />)
