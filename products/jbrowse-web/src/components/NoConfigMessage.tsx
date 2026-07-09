import NoConfigMessageLinkList from './NoConfigMessageLinkList.tsx'
import {
  demoSessions,
  galleryDemos,
  recentConfigs,
  sampleConfigs,
  syntenyConfigs,
} from './NoConfigMessageSampleData.ts'

export default function NoConfigMessage() {
  const url = new URL(window.location.href)
  url.searchParams.delete('config')
  const rest = Object.fromEntries(url.searchParams)
  const root = url.origin + url.pathname

  const buildConfigUrl = (config: string, params?: Record<string, string>) =>
    `${root}?${new URLSearchParams({ ...rest, ...params, config })}`

  return (
    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}>
        <h3 style={{ margin: '0 0 4px' }}>
          Sample configs{' '}
          <small style={{ fontWeight: 'normal', fontSize: '0.8em' }}>
            (local test data, requires dev server)
          </small>
        </h3>
        <NoConfigMessageLinkList
          links={sampleConfigs}
          buildUrl={buildConfigUrl}
        />

        <h3 style={{ margin: '16px 0 4px' }}>Recently added</h3>
        <NoConfigMessageLinkList
          links={recentConfigs}
          buildUrl={buildConfigUrl}
        />

        <h3 style={{ margin: '16px 0 4px' }}>Synteny and dotplot</h3>
        <NoConfigMessageLinkList
          links={syntenyConfigs}
          buildUrl={buildConfigUrl}
        />
      </div>

      <div style={{ flex: 1 }}>
        <h3 style={{ margin: '0 0 4px' }}>Demo sessions</h3>
        <NoConfigMessageLinkList
          links={demoSessions}
          buildUrl={buildConfigUrl}
        />
      </div>

      <div style={{ flex: 1 }}>
        <h3 style={{ margin: '0 0 4px' }}>Gallery demos</h3>
        <NoConfigMessageLinkList
          links={galleryDemos}
          buildUrl={buildConfigUrl}
        />
      </div>
    </div>
  )
}
