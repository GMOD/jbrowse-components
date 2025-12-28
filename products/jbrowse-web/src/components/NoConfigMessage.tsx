export default function NoConfigMessage() {
  const links = [
    ['test_data/volvox/config.json', 'Volvox (sample data)'],
    ['test_data/config.json', 'Human basic'],
    ['test_data/config_demo.json', 'Human sample data'],
    ['test_data/sars-cov2/config.json', 'SARS-CoV2'],
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
    ['test_data/volvox/config_spec.json', 'Volvox (w/ spec session)'],
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
      <div>Demo website:</div>
      <ul>
        <li>
          <a href="?config=test_data/config_demo.json&session=share-oTyYRpz9fN&password=fYAbt">
            {
              'Human instance with HG002 insertion shown (many other tracks available too)'
            }
          </a>
        </li>
        <li>
          <a href="?config=test_data%2Fconfig_demo.json&session=share-pjaAq1hNxB&password=Z9teR">
            {
              'SKBR3 breast cancer cell line - breakpoint split view translocation'
            }
          </a>
        </li>
        <li>
          <a href="?config=test_data%2Fconfig_demo.json&session=share-XyL52LPDoO&password=861E4">
            {
              'Human instance coloring methylation/modifications on nanopore reads'
            }
          </a>
        </li>
        <li>
          <a href="?config=test_data%2Fbreakpoint%2Fconfig.json&session=share-xeUuLRakik&password=vh0ca">
            {
              'Breakpoint split view demo (showing multi-hop split read connection)'
            }
          </a>
        </li>
        <li>
          <a href="?config=test_data%2Fconfig_dotplot.json&session=share-zw51jIwuXb&password=i8WqY">
            {'Grape vs Peach dotplot'}
          </a>
        </li>
        <li>
          <a href="?config=test_data/yeast_synteny/config.json">
            Yeast dotplot
          </a>
        </li>
        <li>
          <a href="?config=%2Fgenomes%2FGRCh38%2F1000genomes%2Fconfig_1000genomes.json&session=share-SUK-mntGyB&password=eQF0F">
            {'1000 genomes extended trio demo'}
          </a>
        </li>
        <li>
          <a href="?config=test_data%2Fvolvox%2Fconfig.json&session=share-JCsm46ATdn&password=ilHg5">
            {'Volvox sample data (small imaginary test datasets)'}
          </a>
        </li>
        <li>
          <a href="?config=test_data%2Fconfig_demo.json&session=share-Pw7kOjagSF&password=e0SuE">
            {'ENCODE Multi-bigwig example'}
          </a>
        </li>
        <li>
          <a href="?config=test_data%2Fconfig_demo.json&session=share-7skGDzEmMi&password=NGzLX">
            {
              'COLO829 melanoma cancer cell line tumor vs normal multi-bigwig example'
            }
          </a>
        </li>
        <li>
          <a href="?config=test_data%2Fconfig_demo.json&session=share-sA7riIQWhJ&password=3pkHd">
            {'Inversion example ("single row" breakpoint split view)'}
          </a>
        </li>
        <li>
          <a href="?config=test_data%2Fconfig_demo.json&session=share-ofjI26CNas&password=ohqlR">
            {'Inversion example (linked reads mode)'}
          </a>
        </li>
        <li>
          <a href="?config=https%3A%2F%2Fjbrowse.org%2Fdemos%2Fplant_synteny_demo%2Fconfig2.json&session=share-pARmvLazem&password=ZPOwE">
            {'Multi-way synteny demo (grape vs peach vs cacao)'}
          </a>
        </li>
        <li>
          <a href="?config=/genomes/potato/config.json">
            {'Tetraploid potato multi-sample VCF rendering'}
          </a>
        </li>
        <li>
          <a href="?config=test_data%2Fconfig_demo.json&session=share-vQBatl-Of9&password=Mhl6F">
            {'Human trio phased VCF rendering'}
          </a>
        </li>
      </ul>
    </div>
  )
}
