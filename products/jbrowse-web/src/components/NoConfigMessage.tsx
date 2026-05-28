import { useState } from 'react'

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

const sampleConfigs: {
  config?: string
  href?: string
  label: string
}[] = [
  {
    config: 'test_data/volvox/config.json',
    label: 'Volvox (sample data)',
  },
  {
    href: '?config=test_data/volvox/config.json&session=spec-{"views":[{"assembly":"volvox","loc":"ctgA:1-50000","type":"LinearGenomeView","tracks":["gff3tabix_genes","volvox_microarray_multi","volvox_bam"]}]}',
    label: 'Volvox (genes + multi-wiggle + BAM)',
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
    config: 'test_data/config_gwas.json',
    label: 'GWAS (Manhattan plot)',
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

const hs1Mm39DotplotSpec = encodeURIComponent(
  JSON.stringify({
    views: [
      {
        type: 'DotplotView',
        tracks: ['hs1ToMm39.over.chain.pif'],
        views: [{ assembly: 'hs1' }, { assembly: 'mm39' }],
        autoDiagonalize: true,
        colorBy: 'query',
        minAlignmentLength: 1000000,
      },
    ],
  }),
)

const syntenyConfigs = [
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
    config: 'test_data/hs1_vs_mm39/config.json',
    label: 'hs1 vs mm39 synteny',
  },
  {
    href: `?config=test_data/hs1_vs_mm39/config.json&session=spec-${hs1Mm39DotplotSpec}`,
    label: 'hs1 vs mm39 dotplot',
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
    href: '?hubURL=https://hgdownload.soe.ucsc.edu/hubs/GCF/019/202/715/GCF_019202715.1/hub.txt&config=none',
    label: 'UCSC GenArk hub (GCF_019202715.1)',
  },
  {
    href: '?config=test_data/config_demo.json&session=share-vQBatl-Of9&password=Mhl6F',
    label: 'Human trio phased VCF rendering',
  },
  {
    href: '?config=test_data/volvox/config.json&session=spec-{"views":[{"assembly":"volvox","type":"CircularView","tracks":["volvox_sv_test"]}]}',
    label: 'Circular genome view (volvox SVs as chords)',
  },
  {
    href: '?config=test_data/config_demo.json&session=spec-{"views":[{"assembly":"hg19","loc":"17:1-83257441","type":"LinearGenomeView","tracks":["hic"]}]}',
    label: 'Hi-C contact matrix (chr17, hg19)',
  },
  {
    href: '?config=test_data/volvox/config.json&session=spec-{"views":[{"assembly":"volvox","loc":"ctgA:1-50000","type":"LinearGenomeView","tracks":["volvox_bedpe"]}]}',
    label: 'BEDPE arc display (volvox SVs)',
  },
  {
    href: '?config=test_data/config_demo.json&session=spec-{"views":[{"assembly":"hg19","loc":"1:1-5000000","type":"LinearGenomeView","tracks":["Pairend_StrandSpecific_51mer_Human_hg19"]}]}',
    label: 'Paired-end stranded RNA-seq',
  },
  {
    href: '?config=test_data/config_demo.json&session=spec-{"views":[{"assembly":"hg38","loc":"15:23900000-24000000","type":"LinearGenomeView","tracks":["HG002_WGS_fiberseq.MAGEL2_2"]}]}',
    label: 'Fiber-seq (5mC on single molecules, MAGEL2)',
  },
  {
    href: '?config=test_data/config_demo.json&session=spec-{"views":[{"assembly":"hg38","loc":"17:43000000-43200000","type":"LinearGenomeView","tracks":["NA12878-DirectRNA.pass.dedup.NoU.fastq.hg38.minimap2.sorted"]}]}',
    label: 'Direct RNA-seq nanopore (BRCA1)',
  },
] as const

const galleryDemos = [
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
