import {
  parseConfigUrl,
  parseSessionSnapshotUrl,
  parseSessionSpecUrl,
} from '@jbrowse/app-core'

import { linkConfigUrl } from '../../../electron/linkPrompt.ts'

// The main process cannot import app-core, so the link dialog reads `config=`
// itself; these are the link forms launchFromLink opens, and the dialog has to
// name the config each one fetches.
function fetchedConfigUrl(link: string) {
  const snapshot = parseSessionSnapshotUrl(link)
  if (snapshot) {
    return snapshot.configUrl
  }
  try {
    return parseSessionSpecUrl(link).configUrl
  } catch {
    return parseConfigUrl(link)
  }
}

const page = 'https://jbrowse.org/code/jb2/main/'
const spec = `spec-${encodeURIComponent(JSON.stringify({ views: [] }))}`

test.each([
  `${page}?config=test_data/volvox/config.json&session=${spec}`,
  `${page}?config=%2Fucsc%2Fhg38%2Fconfig.json&session=${spec}`,
  `${page}?config=https%3A%2F%2Fexample.com%2Fc.json&session=${spec}`,
  `${page}?config=none&session=${spec}`,
  `${page}?session=${spec}`,
  `${page}#config=test_data/volvox/config.json&session=${spec}`,
  `${page}?config=test_data/volvox/config.json&loc=ctgA:1-100&assembly=volvox`,
  `${page}?loc=chr1:1-100&assembly=hg38`,
  `${page}?config=none&hubURL=https://example.com/hub.txt`,
  `${page}?config=test_data/volvox/config.json`,
  `${page}?session=share-abc&password=pw`,
  `${page}?config=x/config.json&session=encoded-abc`,
  `${page}#session=json-%7B%7D`,
  'https://jbrowse.org/genomes/hg38/config.json',
])('the link dialog names the config launchFromLink fetches: %s', link => {
  expect(linkConfigUrl(new URL(link))).toBe(fetchedConfigUrl(link))
})
