import React from 'react'

export default function NoConfigMessage() {
  const links = [
    ['test_data/volvox/config.json', 'Volvox (sample data)'],
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
    ['test_data/volvox/theme.json', 'Theme test (wild color)'],
    ['test_data/volvox/theme2.json', 'Theme test (wormbase color)'],
    ['test_data/wgbs/config.json', 'WGBS methylation'],
    ['test_data/methylation_test/config.json', 'Nanopore methylation'],
    ['test_data/volvox/config_main_thread.json', 'Volvox (mainthreadrpc)'],
    ['test_data/volvox/config_auth_main.json', 'Volvox (auth, mainthreadrpc)'],
    ['test_data/volvox/config_auth.json', 'Volvox (auth)'],
    ['test_data/volvoxhub/config.json', 'Volvox (with ucsc-hub)'],
  ]
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
