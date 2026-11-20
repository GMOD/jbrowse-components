import { parseSessionSnapshotUrl } from '@jbrowse/app-core'
import { toProtocolUrl } from '@jbrowse/core/util/jbrowseProtocol'

test.each([
  'https://app.example/jb/?config=c.json#session=share-abc123&password=XyZ12',
  'https://app.example/jb/?config=c.json#session=encoded-H4sIAAAA%2B%3D',
])(
  "unwrapping the Share dialog's Desktop link yields the share link: %s",
  shareUrl => {
    const parsed = parseSessionSnapshotUrl(toProtocolUrl(shareUrl))
    expect(parsed?.pageUrl).toBe(shareUrl)
  },
)
