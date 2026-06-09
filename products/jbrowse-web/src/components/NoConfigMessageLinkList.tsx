import { makeStyles } from '@jbrowse/core/util/tss-react'

import type { SampleLink } from './NoConfigMessageSampleData.ts'

const useStyles = makeStyles()({
  item: {
    marginBottom: 4,
  },
  badges: {
    color: '#666',
  },
  badge: {
    color: '#666',
    textDecoration: 'none',
    cursor: 'pointer',
    '&:hover': {
      color: '#000',
      textDecoration: 'underline',
    },
  },
})

const renderers = ['webgpu', 'webgl', 'canvas']

export default function NoConfigMessageLinkList({
  links,
  buildUrl,
}: {
  links: readonly SampleLink[]
  buildUrl: (config: string, params?: Record<string, string>) => string
}) {
  const { classes } = useStyles()

  return (
    <ul>
      {links.map(({ config, href, label }) => {
        const finalHref = href ?? (config ? buildUrl(config) : '')

        const buildBadgeHref = (r: string) => {
          if (href) {
            const params = new URLSearchParams(href.split('?', 2)[1] ?? '')
            params.set('renderer', r)
            return `?${params}`
          }
          return config ? buildUrl(config, { renderer: r }) : finalHref
        }

        return (
          <li key={label} className={classes.item}>
            <a href={finalHref}>{label}</a>{' '}
            <small className={classes.badges}>
              {renderers.map(r => (
                <a key={r} href={buildBadgeHref(r)} className={classes.badge}>
                  [{r}]
                </a>
              ))}
            </small>
          </li>
        )
      })}
    </ul>
  )
}
