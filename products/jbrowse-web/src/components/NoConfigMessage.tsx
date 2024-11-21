import React from 'react'

export default function NoConfigMessage() {
  const links = [
    ['test_data/volvox/config.json', 'Volvox (sample data)'],
    ['test_data/config.json', 'Human basic'],
    ['test_data/config_demo.json', 'Human sample data'],
    ['test_data/sars-cov2/config.json', 'SARS-CoV2'],
    ['test_data/tomato/config.json', 'Tomato SVs'],
    ['test_data/cfam2/config.json', 'Dog (NCBI sequence aliases adapter)'],
    ['test_data/breakpoint/config.json', 'Breakpoint'],
    ['test_data/config_dotplot.json', 'Grape/Peach dotplot'],
    ['test_data/config_synteny_grape_peach.json', 'Grape/Peach synteny'],
    ['test_data/hs1_vs_mm39/config.json', 'Hs1 vs mm39 synteny'],
    ['test_data/yeast_synteny/config.json', 'Yeast synteny'],
    ['test_data/many_contigs/config.json', 'Many contigs'],
    ['test_data/honeybee/config.json', 'Honeybee'],
    ['test_data/wormbase/config.json', 'Wormbase'],
    ['test_data/config_human_dotplot.json', 'Human dotplot'],
    ['test_data/volvox/theme.json', 'Theme test (wild color)'],
    ['test_data/volvox/theme2.json', 'Theme test (wormbase color)'],
    ['test_data/wgbs/config.json', 'WGBS methylation'],
    ['test_data/methylation_test/config.json', 'Nanopore methylation'],
    ['test_data/volvox/config_main_thread.json', 'Volvox (mainthreadrpc)'],
    ['test_data/volvox/config_auth_main.json', 'Volvox (auth, mainthreadrpc)'],
    ['test_data/volvox/config_auth.json', 'Volvox (auth)'],
    ['test_data/volvoxhub/config.json', 'Volvox (with ucsc-hub)'],
  ] as const
  const { href, search } = window.location
  const { config, ...rest } = Object.fromEntries(new URLSearchParams(search))
  const root = href.split('?')[0]
  return (
    <div>
      <div>Sample JBrowse configs:</div>
      <ul>
        {links.map(([link, name]) => {
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
    </div>
  )
}
