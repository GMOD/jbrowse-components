import React from 'react'

const extractConfigFromHref = (h: string) => {
  const params = new URLSearchParams(h.split('?')[1] || '')
  return params.get('config')
}

function LinkList({
  links,
  buildUrl,
}: {
  links: readonly {
    config?: string
    href?: string
    label: string
    renderers?: readonly string[]
  }[]
  buildUrl?: (config: string, params?: Record<string, string>) => string
}) {
  const [hoveredBadge, setHoveredBadge] = React.useState<string | null>(null)

  return (
    <ul>
      {links.map(({ config, href, label, renderers }) => {
        const finalHref =
          href ||
          (config && buildUrl ? buildUrl(config) : `?config=${config || ''}`)

        const configForRenderers =
          config || (href ? extractConfigFromHref(href) : null)

        const defaultRenderers = ['webgpu', 'webgl', 'canvas']
        const badgeList = renderers?.length ? renderers : defaultRenderers
        const badgeKey = `${label}:${renderers?.length ? renderers.join(',') : 'default'}`
        return (
          <li key={label} style={{ marginBottom: 4 }}>
            <a href={finalHref}>{label}</a>{' '}
            <small style={{ color: '#666' }}>
              {badgeList.map(r => {
                const badgeId = `${badgeKey}:${r}`
                return (
                  <span key={r}>
                    <a
                      href={
                        configForRenderers && buildUrl
                          ? buildUrl(configForRenderers, { renderer: r })
                          : finalHref
                      }
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

const sampleConfigs: {
  config: string
  label: string
}[] = [
  {
    config: 'test_data/volvox/config.json',
    label: 'Volvox (sample data)',
  },
  {
    config: 'test_data/config.json',
    label: 'Human basic',
  },
  {
    config: 'test_data/config_demo.json',
    label: 'Human sample data',
  },
  {
    config: 'test_data/sars-cov2/config.json',
    label: 'SARS-CoV2',
  },
  {
    config: 'test_data/cfam2/config.json',
    label: 'Dog (NCBI adapter)',
  },
  {
    config: 'test_data/honeybee/config.json',
    label: 'Honeybee',
  },
  {
    config: 'test_data/wormbase/config.json',
    label: 'Wormbase',
  },
  {
    config: 'test_data/breakpoint/config.json',
    label: 'Breakpoint',
  },
  {
    config: 'test_data/many_contigs/config.json',
    label: 'Many contigs',
  },
  {
    config: 'test_data/wgbs/config.json',
    label: 'WGBS methylation',
  },
  {
    config: 'test_data/methylation_test/config.json',
    label: 'Nanopore methylation',
  },
  {
    config: 'test_data/volvox/config_main_thread.json',
    label: 'Volvox (main thread)',
  },
  {
    config: 'test_data/volvox/config_auth_main.json',
    label: 'Volvox (auth, main thread)',
  },
  {
    config: 'test_data/volvox/config_auth.json',
    label: 'Volvox (auth)',
  },
  {
    config: 'test_data/volvox/config_spec.json',
    label: 'Volvox (w/ spec session)',
  },
  {
    config: 'test_data/volvoxhub/config.json',
    label: 'Volvox (UCSC hub)',
  },
  {
    config: 'test_data/volvox/theme.json',
    label: 'Theme (wild color)',
  },
  {
    config: 'test_data/volvox/theme2.json',
    label: 'Theme (wormbase)',
  },
]

const syntenyConfigs: {
  config: string
  label: string
}[] = [
  {
    config: 'test_data/config_synteny_grape_peach.json',
    label: 'Grape/Peach synteny',
  },
  {
    config: 'test_data/config_dotplot.json',
    label: 'Grape/Peach dotplot',
  },
  {
    config: 'test_data/config_human_dotplot.json',
    label: 'Human dotplot',
  },
  {
    config: 'test_data/yeast_synteny/config.json',
    label: 'Yeast synteny',
  },
  {
    config: 'test_data/config_synteny_nway.json',
    label: '3-way volvox synteny',
  },
  {
    config: 'test_data/config_multi_lgv_synteny.json',
    label: 'Multi-genome volvox',
  },
  {
    config: 'test_data/hprc/config_hprc_chrM.json',
    label: 'HPRC chrM (44 haps)',
  },
  {
    config: 'test_data/hprc/config_hprc_chr20.json',
    label: 'HPRC chr20 (90 haps)',
  },
  {
    config: 'test_data/config_gfa_pangenome.json',
    label: 'Volvox GFA pangenome',
  },
  {
    config: 'test_data/config_graph_genome.json',
    label: 'Graph genome (GFA)',
  },
  {
    config: 'test_data/hs1_vs_mm39/config.json',
    label: 'hs1 vs mm39',
  },
  {
    config: 'test_data/hg19_vs_hg38/config.json',
    label: 'hg19 vs hg38 liftover',
  },
]

const demoSessions = [
  {
    href: '?config=test_data/config_demo.json&session=share-oTyYRpz9fN&password=fYAbt',
    label: 'Human instance with HG002 insertion shown',
  },
  {
    href: '?config=test_data/config_demo.json&session=share-pjaAq1hNxB&password=Z9teR',
    label: 'SKBR3 breakpoint split view',
  },
  {
    href: '?config=test_data/config_demo.json&session=share-XyL52LPDoO&password=861E4',
    label: 'Methylation/modifications nanopore',
  },
  {
    href: '?config=test_data/breakpoint/config.json&session=share-xeUuLRakik&password=vh0ca',
    label: 'Breakpoint split view demo (multi-hop)',
  },
  {
    href: '?config=test_data/config_dotplot.json&session=share-zw51jIwuXb&password=i8WqY',
    label: 'Grape vs Peach dotplot',
  },
  {
    href: '?config=test_data/yeast_synteny/config.json',
    label: 'Yeast dotplot',
  },
  {
    href: '?config=https://jbrowse.org/genomes/GRCh38/1000genomes/config_1000genomes.json&session=share-SUK-mntGyB&password=eQF0F',
    label: '1000 genomes extended trio demo',
  },

  {
    href: '?config=test_data/config_demo.json&session=share-Pw7kOjagSF&password=e0SuE',
    label: 'ENCODE Multi-bigwig example',
  },
  {
    href: '?config=test_data/config_demo.json&session=share-7skGDzEmMi&password=NGzLX',
    label: 'COLO829 tumor vs normal multi-bigwig',
  },
  {
    href: '?config=test_data/config_demo.json&session=share-sA7riIQWhJ&password=3pkHd',
    label: 'Inversion "single row" breakpoint view',
  },
  {
    href: '?config=test_data/config_demo.json&session=share-ofjI26CNas&password=ohqlR',
    label: 'Inversion example (linked reads mode)',
  },
  {
    href: '?config=https://jbrowse.org/demos/plant_synteny_demo/config2.json&session=share-pARmvLazem&password=ZPOwE',
    label: 'Grape vs peach vs cacao',
  },
  {
    href: '?config=https://jbrowse.org/genomes/potato/config.json',
    label: 'Tetraploid potato multi-sample VCF',
  },
  {
    href: '?config=test_data/config_demo.json&session=share-vQBatl-Of9&password=Mhl6F',
    label: 'Human trio phased VCF rendering',
  },
] as const

const galleryDemos: {
  href: string
  label: string
}[] = [
  {
    href: '?config=test_data%2Fconfig_dotplot.json&session=share-r4sMB3bHh5&password=C9jCa',
    label: 'Dotplot grape vs peach genome',
  },
  {
    href: '?config=test_data%2Fconfig_dotplot.json&session=share-4MjF5YGM_G&password=rByjt',
    label: 'Synteny grape vs peach',
  },
  {
    href: 'test_data/hs1_vs_mm39/config.json?config=test_data%2Fhs1_vs_mm39%2Fconfig.json&session=share-sYw9py4ItD&password=fAVJa',
    label: 'Hs1 vs mm39 synteny',
  },
  {
    href: '?config=test_data%2Fconfig_demo.json&session=share-xS8Eg67AFS&password=jPzH5',
    label: 'Hi-C contact matrix',
  },
  {
    href: '?config=test_data%2Fconfig_demo.json&session=share-n9_vE%2FEl2R&password=wu9J6',
    label: 'SKBR3 SV inspector',
  },
  {
    href: '?config=test_data%2Fconfig_demo.json&session=share-6pkcSXlbFL&password=ER28C',
    label: 'Horizontally flipped demo',
  },
  {
    href: '?config=test_data%2Fconfig_demo.json&session=share-AcZSrC_yOb&password=e7b64',
    label: 'COLO829 tumor vs normal',
  },
  {
    href: '?config=test_data%2Fconfig_demo.json&session=share-Swq8pJTX0z&password=yM41l',
    label: 'SKBR3 using breakpoint split view',
  },
  {
    href: '?config=test_data%2Fconfig_demo.json&session=share-psOr2x2efp&password=bErZE',
    label: 'GIAB - Heterozygous small deletion',
  },
  {
    href: '?config=test_data/config_demo.json&session=share-oTyYRpz9fN&password=fYAbt',
    label: 'GIAB - ~1.5kb insertion',
  },
  {
    href: '?config=test_data%2Fconfig_demo.json&session=share-rzJ27iixQH&password=rSgZe',
    label: 'SKBR3 - ~500bp insertion',
  },
  {
    href: '?config=test_data%2Fconfig_demo.json&session=share-LffYr8SI5E&password=VmZVl',
    label: 'Methylated and unmethylated CpG',
  },
  {
    href: '?config=https://jbrowse.org/genomes/GRCh38/1000genomes/config_1000genomes.json&session=share-DN_h4SIwo4&password=CxkLw',
    label: '1000 genomes SV call w/ INV on chr19',
  },
]

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
        <LinkList links={sampleConfigs} buildUrl={buildConfigUrl} />

        <h3 style={{ margin: '16px 0 4px' }}>Synteny and dotplot</h3>
        <LinkList links={syntenyConfigs} buildUrl={buildConfigUrl} />
      </div>

      <div style={{ flex: 1 }}>
        <h3 style={{ margin: '0 0 4px' }}>Demo sessions</h3>
        <LinkList links={demoSessions} buildUrl={buildConfigUrl} />
      </div>

      <div style={{ flex: 1 }}>
        <h3 style={{ margin: '0 0 4px' }}>Gallery demos</h3>
        <LinkList links={galleryDemos} buildUrl={buildConfigUrl} />
      </div>
    </div>
  )
}
