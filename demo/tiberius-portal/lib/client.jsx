import { hydrateRoot } from 'react-dom/client'

import { App } from './app.jsx'

const data = JSON.parse(document.getElementById('portal-data').textContent)

// An inlined capture is in the markup already; page.mjs leaves it out of the
// JSON rather than shipping a quarter-megabyte of it twice. Put them back
// before hydrating, or React renders an <img> with no src over one that has it.
const shots = new Map()
for (const el of document.querySelectorAll('#root .card')) {
  const img = el.querySelector('img.shot')
  if (img) {
    shots.set(el.dataset.id, img.getAttribute('src'))
  }
}
for (const card of data.cards) {
  if (!card.img && shots.has(card.id)) {
    card.img = shots.get(card.id)
  }
}

hydrateRoot(document.getElementById('root'), <App data={data} />)
