import { parseSessionSnapshotUrl } from '@jbrowse/app-core'

import { toDesktopLink } from './toDesktopLink.ts'

test.each([
  'https://app.example/jb/?config=c.json#session=share-abc123&password=XyZ12',
  'https://app.example/jb/?config=c.json#session=encoded-H4sIAAAA%2B%3D',
])('unwrapping the Desktop link yields the share link: %s', shareUrl => {
  const parsed = parseSessionSnapshotUrl(toDesktopLink(shareUrl))
  expect(parsed?.pageUrl).toBe(shareUrl)
})
