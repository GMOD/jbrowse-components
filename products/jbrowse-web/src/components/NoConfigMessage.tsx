import NoConfigMessageLinkList from './NoConfigMessageLinkList.tsx'
import {
  demoSessions,
  galleryDemos,
  recentConfigs,
  sampleConfigs,
  syntenyConfigs,
} from './NoConfigMessageSampleData.ts'

export default function NoConfigMessage() {
  const { href, search } = window.location
  const { config: _config, ...rest } = Object.fromEntries(
    new URLSearchParams(search),
  )

  const root = href.split('?')[0]

  const buildConfigUrl = (config: string, params?: Record<string, string>) => {
    return `${root}?${new URLSearchParams(
      Object.entries({ ...rest, ...params, config }),
    )}`
  }

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
