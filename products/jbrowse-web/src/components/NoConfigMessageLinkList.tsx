import { useState } from 'react'

import type { SampleLink } from './NoConfigMessageSampleData.ts'

export default function NoConfigMessageLinkList({
  links,
  buildUrl,
}: {
  links: readonly SampleLink[]
  buildUrl?: (config: string, params?: Record<string, string>) => string
}) {
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null)

  return (
    <ul>
      {links.map(({ config, href, label, renderers }) => {
        const finalHref =
          href ??
          (config && buildUrl ? buildUrl(config) : `?config=${config ?? ''}`)

        const defaultRenderers = ['webgpu', 'webgl', 'canvas']
        const badgeList = renderers?.length ? renderers : defaultRenderers
        const badgeKey = `${label}:${renderers?.length ? renderers.join(',') : 'default'}`

        const buildBadgeHref = (r: string) => {
          if (href) {
            const params = new URLSearchParams(href.split('?')[1] ?? '')
            params.set('renderer', r)
            return `?${params}`
          }
          return config && buildUrl
            ? buildUrl(config, { renderer: r })
            : finalHref
        }

        return (
          <li key={label} style={{ marginBottom: 4 }}>
            <a href={finalHref}>{label}</a>{' '}
            <small style={{ color: '#666' }}>
              {badgeList.map(r => {
                const badgeId = `${badgeKey}:${r}`
                return (
                  <span key={r}>
                    <a
                      href={buildBadgeHref(r)}
                      onMouseEnter={() => {
                        setHoveredBadge(badgeId)
                      }}
                      onMouseLeave={() => {
                        setHoveredBadge(null)
                      }}
                      style={{
                        color: hoveredBadge === badgeId ? '#000' : '#666',
                        textDecoration:
                          hoveredBadge === badgeId ? 'underline' : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      [{r}]
                    </a>
                  </span>
                )
              })}
            </small>
          </li>
        )
      })}
    </ul>
  )
}
