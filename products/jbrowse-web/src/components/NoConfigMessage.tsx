function configLink(
  root: string,
  rest: Record<string, string>,
  link: string,
) {
  const params = new URLSearchParams(
    Object.entries({ ...rest, config: link }),
  )
  return `${root}?${params}`
}

function ConfigLinkList({
  root,
  rest,
  links,
}: {
  root: string
  rest: Record<string, string>
  links: [string, string][]
}) {
  return (
    <ul>
      {links.map(([link, name]) => (
        <li key={name}>
          <a href={configLink(root, rest, link)}>{name}</a>
        </li>
      ))}
    </ul>
  )
}

function SessionLinkList({
  links,
}: {
  links: { href: string; label: string }[]
}) {
  return (
    <ul>
      {links.map(({ href, label }) => (
        <li key={label}>
          <a href={href}>{label}</a>
        </li>
      ))}
    </ul>
  )
}

const sampleConfigs: [string, string][] = [
  ['test_data/volvox/config.json', 'Volvox (sample data)'],
  ['test_data/config.json', 'Human basic'],
  ['test_data/config_demo.json', 'Human sample data'],
  ['test_data/sars-cov2/config.json', 'SARS-CoV2'],
  ['test_data/cfam2/config.json', 'Dog (NCBI sequence aliases adapter)'],
  ['test_data/honeybee/config.json', 'Honeybee'],
  ['test_data/wormbase/config.json', 'Wormbase'],
  ['test_data/breakpoint/config.json', 'Breakpoint'],
  ['test_data/many_contigs/config.json', 'Many contigs'],
  ['test_data/wgbs/config.json', 'WGBS methylation'],
  ['test_data/methylation_test/config.json', 'Nanopore methylation'],
  ['test_data/volvox/config_main_thread.json', 'Volvox (mainthreadrpc)'],
  ['test_data/volvox/config_auth_main.json', 'Volvox (auth, mainthreadrpc)'],
  ['test_data/volvox/config_auth.json', 'Volvox (auth)'],
  ['test_data/volvox/config_spec.json', 'Volvox (w/ spec session)'],
  ['test_data/volvoxhub/config.json', 'Volvox (with ucsc-hub)'],
  ['test_data/volvox/theme.json', 'Theme test (wild color)'],
  ['test_data/volvox/theme2.json', 'Theme test (wormbase color)'],
]

const syntenyConfigs: [string, string][] = [
  ['test_data/config_synteny_grape_peach.json', 'Grape/Peach synteny'],
  ['test_data/config_dotplot.json', 'Grape/Peach dotplot'],
  ['test_data/config_human_dotplot.json', 'Human dotplot'],
  ['test_data/yeast_synteny/config.json', 'Yeast synteny'],
  [
    'test_data/config_synteny_nway.json',
    '3-way volvox synteny (volvox+ins+del)',
  ],
  [
    'test_data/config_multi_lgv_synteny.json',
    'Multi-genome volvox synteny (LGV, multi-pair)',
  ],
  [
    'test_data/arabidopsis_synteny/config.json',
    'Arabidopsis 4-way synteny (Col-0, Ler, Cvi, Eri)',
  ],
  [
    'test_data/arabidopsis_synteny/config_chrM_pangenome.json',
    'Human chrM pangenome (4 genomes, GFA tabix)',
  ],
  [
    'test_data/hprc/config_hprc_chrM.json',
    'HPRC chrM pangenome (44 haplotypes, minigraph-cactus)',
  ],
]

const demoSessions: { href: string; label: string }[] = [
  {
    href: '?config=test_data/config_demo.json&session=share-oTyYRpz9fN&password=fYAbt',
    label: 'Human instance with HG002 insertion shown',
  },
  {
    href: '?config=test_data/config_demo.json&session=share-pjaAq1hNxB&password=Z9teR',
    label: 'SKBR3 breast cancer cell line - breakpoint split view translocation',
  },
  {
    href: '?config=test_data/config_demo.json&session=share-XyL52LPDoO&password=861E4',
    label: 'Human instance coloring methylation/modifications on nanopore reads',
  },
  {
    href: '?config=test_data/breakpoint/config.json&session=share-xeUuLRakik&password=vh0ca',
    label: 'Breakpoint split view demo (multi-hop split read connection)',
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
    href: '?config=test_data/volvox/config.json&session=share-JCsm46ATdn&password=ilHg5',
    label: 'Volvox sample data (small imaginary test datasets)',
  },
  {
    href: '?config=test_data/config_demo.json&session=share-Pw7kOjagSF&password=e0SuE',
    label: 'ENCODE Multi-bigwig example',
  },
  {
    href: '?config=test_data/config_demo.json&session=share-7skGDzEmMi&password=NGzLX',
    label: 'COLO829 melanoma cancer cell line tumor vs normal multi-bigwig',
  },
  {
    href: '?config=test_data/config_demo.json&session=share-sA7riIQWhJ&password=3pkHd',
    label: 'Inversion example ("single row" breakpoint split view)',
  },
  {
    href: '?config=test_data/config_demo.json&session=share-ofjI26CNas&password=ohqlR',
    label: 'Inversion example (linked reads mode)',
  },
  {
    href: '?config=https://jbrowse.org/demos/plant_synteny_demo/config2.json&session=share-pARmvLazem&password=ZPOwE',
    label: 'Multi-way synteny demo (grape vs peach vs cacao)',
  },
  {
    href: '?config=https://jbrowse.org/genomes/potato/config.json',
    label: 'Tetraploid potato multi-sample VCF rendering',
  },
  {
    href: '?config=test_data/config_demo.json&session=share-vQBatl-Of9&password=Mhl6F',
    label: 'Human trio phased VCF rendering',
  },
]

const galleryDemos: { href: string; label: string }[] = [
  {
    href: '?config=test_data%2Fconfig_dotplot.json&session=share-r4sMB3bHh5&password=C9jCa',
    label: 'Dotplot showing alignment between grape vs peach genome',
  },
  {
    href: '?config=test_data%2Fconfig_dotplot.json&session=share-4MjF5YGM_G&password=rByjt',
    label: 'Linear synteny view of grape vs peach genome',
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
    label: 'SV inspector displaying inter-chromosomal translocations in SKBR3',
  },
  {
    href: '?config=test_data%2Fconfig_demo.json&session=share-6pkcSXlbFL&password=ER28C',
    label: 'Horizontally flip feature demonstration',
  },
  {
    href: '?config=test_data%2Fconfig_demo.json&session=share-AcZSrC_yOb&password=e7b64',
    label: 'COLO829 melanoma coverage (multi-quantitative track)',
  },
  {
    href: '?config=test_data%2Fconfig_demo.json&session=share-Swq8pJTX0z&password=yM41l',
    label: 'Translocation in SKBR3 using breakpoint split view',
  },
  {
    href: '?config=test_data%2Fconfig_demo.json&session=share-psOr2x2efp&password=bErZE',
    label: 'Heterozygous small deletion in GIAB dataset',
  },
  {
    href: '?config=test_data/config_demo.json&session=share-oTyYRpz9fN&password=fYAbt',
    label: '~1.5kb insertion in GIAB dataset',
  },
  {
    href: '?config=test_data%2Fconfig_demo.json&session=share-rzJ27iixQH&password=rSgZe',
    label: '~500bp insertion from SKBR3 PacBio reads',
  },
  {
    href: '?config=test_data%2Fconfig_demo.json&session=share-LffYr8SI5E&password=VmZVl',
    label: 'Methylated and unmethylated CpG island with nanopore reads',
  },
  {
    href: '?config=https://jbrowse.org/genomes/GRCh38/1000genomes/config_1000genomes.json&session=share-DN_h4SIwo4&password=CxkLw',
    label: '1000 genomes structural variant call with large inversion on chr19',
  },
]

export default function NoConfigMessage() {
  const { href, search } = window.location
  const { config: _config, ...rest } = Object.fromEntries(
    new URLSearchParams(search),
  )
  const root = href.split('?')[0] ?? href
  return (
    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}>
        <h3 style={{ margin: '0 0 4px' }}>
          Sample configs{' '}
          <small style={{ fontWeight: 'normal', fontSize: '0.8em' }}>
            (local test data, requires dev server)
          </small>
        </h3>
        <ConfigLinkList root={root} rest={rest} links={sampleConfigs} />

        <h3 style={{ margin: '16px 0 4px' }}>Synteny and dotplot</h3>
        <ConfigLinkList root={root} rest={rest} links={syntenyConfigs} />
      </div>

      <div style={{ flex: 1 }}>
        <h3 style={{ margin: '0 0 4px' }}>Demo sessions</h3>
        <SessionLinkList links={demoSessions} />
      </div>

      <div style={{ flex: 1 }}>
        <h3 style={{ margin: '0 0 4px' }}>Gallery demos</h3>
        <SessionLinkList links={galleryDemos} />
      </div>
    </div>
  )
}
