import React, { Suspense } from 'react'
import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { inDevelopment } from '@jbrowse/core/util'

function NoConfigMessage() {
  const links = [
    ['test_data/volvox/config.json', 'Volvox sample data'],
    ['test_data/volvoxhub/config.json', 'Volvox hub sample data'],
    ['test_data/config.json', 'Human basic'],
    ['test_data/config_demo.json', 'Human sample data'],
    ['test_data/tomato/config.json', 'Tomato SVs'],
    ['test_data/breakpoint/config.json', 'Breakpoint'],
    ['test_data/config_dotplot.json', 'Grape/Peach dotplot'],
    ['test_data/config_synteny_grape_peach.json', 'Grape/Peach synteny'],
    ['test_data/human_vs_mouse.json', 'Human vs mouse synteny'],
    ['test_data/yeast_synteny/config.json', 'Yeast synteny'],
    ['test_data/config_many_contigs.json', 'Many contigs'],
    ['test_data/config_honeybee.json', 'Honeybee'],
    ['test_data/config_wormbase.json', 'Wormbase'],
    ['test_data/config_human_dotplot.json', 'Human dotplot'],
    ['test_data/wgbs/config.json', 'WGBS methylation'],
  ]
  return (
    <div>
      <h4>
        Configuration not found. You may have arrived here if you requested a
        config that does not exist or you have not set up your JBrowse yet.
      </h4>
      {inDevelopment ? (
        <>
          <div>Sample JBrowse configs:</div>
          <ul>
            {links.map(([link, name]) => {
              const { href, search } = window.location
              const { config, ...rest } = Object.fromEntries(
                new URLSearchParams(search),
              )
              const root = href.split('?')[0]
              const params = new URLSearchParams(
                Object.entries({
                  ...rest,
                  config: link,
                }),
              )
              return (
                <li key={name}>
                  <a href={`${root}?${params}`}>{name}</a>
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <>
          <div>Sample JBrowse config:</div>
          <ul>
            <li>
              <a href="?config=test_data/volvox/config.json">
                Volvox sample data
              </a>
            </li>
          </ul>
        </>
      )}
    </div>
  )
}

const StartScreenErrorMessage = ({ error }: { error: unknown }) => {
  return (
    <>
      <NoConfigMessage />
      {`${error}`.match(/HTTP 404 fetching config.json/) ? (
        <div
          style={{
            margin: 8,
            padding: 8,
            border: '1px solid black',
            background: '#9f9',
          }}
        >
          No config.json found. If you want to learn how to complete your setup,
          visit our{' '}
          <a href="https://jbrowse.org/jb2/docs/quickstart_web/">
            quick start guide
          </a>
          .
        </div>
      ) : (
        <Suspense fallback={<LoadingEllipses />}>
          <ErrorMessage error={error} />
        </Suspense>
      )}
    </>
  )
}

export default StartScreenErrorMessage
