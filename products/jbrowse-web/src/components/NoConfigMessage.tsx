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
          <a href="?config=test_data/config_demo.json&session=share-pjaAq1hNxB&password=Z9teR">
            {
              'SKBR3 breast cancer cell line - breakpoint split view translocation'
            }
          </a>
        </li>
        <li>
          <a href="?config=test_data/config_demo.json&session=share-XyL52LPDoO&password=861E4">
            {
              'Human instance coloring methylation/modifications on nanopore reads'
            }
          </a>
        </li>
        <li>
          <a href="?config=test_data/breakpoint/config.json&session=share-xeUuLRakik&password=vh0ca">
            {
              'Breakpoint split view demo (showing multi-hop split read connection)'
            }
          </a>
        </li>
        <li>
          <a href="?config=test_data/config_dotplot.json&session=share-zw51jIwuXb&password=i8WqY">
            {'Grape vs Peach dotplot'}
          </a>
        </li>
        <li>
          <a href="?config=test_data/yeast_synteny/config.json">
            Yeast dotplot
          </a>
        </li>
        <li>
          <a href="?config=https://jbrowse.org/genomes/GRCh38/1000genomes/config_1000genomes.json&session=share-SUK-mntGyB&password=eQF0F">
            {'1000 genomes extended trio demo'}
          </a>
        </li>
        <li>
          <a href="?config=test_data/volvox/config.json&session=share-JCsm46ATdn&password=ilHg5">
            {'Volvox sample data (small imaginary test datasets)'}
          </a>
        </li>
        <li>
          <a href="?config=test_data/config_demo.json&session=share-Pw7kOjagSF&password=e0SuE">
            {'ENCODE Multi-bigwig example'}
          </a>
        </li>
        <li>
          <a href="?config=test_data/config_demo.json&session=share-7skGDzEmMi&password=NGzLX">
            {
              'COLO829 melanoma cancer cell line tumor vs normal multi-bigwig example'
            }
          </a>
        </li>
        <li>
          <a href="?config=test_data/config_demo.json&session=share-sA7riIQWhJ&password=3pkHd">
            {'Inversion example ("single row" breakpoint split view)'}
          </a>
        </li>
        <li>
          <a href="?config=test_data/config_demo.json&session=share-ofjI26CNas&password=ohqlR">
            {'Inversion example (linked reads mode)'}
          </a>
        </li>
        <li>
          <a href="?config=https://jbrowse.org/demos/plant_synteny_demo/config2.json&session=share-pARmvLazem&password=ZPOwE">
            {'Multi-way synteny demo (grape vs peach vs cacao)'}
          </a>
        </li>
        <li>
          <a href="?config=https://jbrowse.org/genomes/potato/config.json">
            {'Tetraploid potato multi-sample VCF rendering'}
          </a>
        </li>
        <li>
          <a href="?config=test_data/config_demo.json&session=share-vQBatl-Of9&password=Mhl6F">
            {'Human trio phased VCF rendering'}
          </a>
        </li>
      </ul>
      <div>Gallery demos:</div>
      <ul>
        <li>
          <a href="?config=test_data%2Fconfig_dotplot.json&session=share-r4sMB3bHh5&password=C9jCa">
            {'Dotplot showing alignment between grape vs peach genome'}
          </a>
        </li>
        <li>
          <a href="?config=test_data%2Fconfig_dotplot.json&session=share-4MjF5YGM_G&password=rByjt">
            {'Linear synteny view of grape vs peach genome'}
          </a>
        </li>
        <li>
          <a href="?config=test_data%2Fconfig_demo.json&session=share-xS8Eg67AFS&password=jPzH5">
            {'Hi-C contact matrix'}
          </a>
        </li>
        <li>
          <a href="?config=test_data%2Fconfig_demo.json&session=share-n9_vE%2FEl2R&password=wu9J6">
            {
              'SV inspector displaying inter-chromosomal translocations in SKBR3'
            }
          </a>
        </li>
        <li>
          <a href="?config=test_data%2Fconfig_demo.json&session=share-6pkcSXlbFL&password=ER28C">
            {'Horizontally flip feature demonstration'}
          </a>
        </li>
        <li>
          <a href="?config=test_data%2Fconfig_demo.json&session=share-AcZSrC_yOb&password=e7b64">
            {'COLO829 melanoma coverage (multi-quantitative track)'}
          </a>
        </li>
        <li>
          <a href="?config=test_data%2Fconfig_demo.json&session=share-Swq8pJTX0z&password=yM41l">
            {'Translocation in SKBR3 using breakpoint split view'}
          </a>
        </li>
        <li>
          <a href="?config=test_data%2Fconfig_demo.json&session=share-psOr2x2efp&password=bErZE">
            {'Heterozygous small deletion in GIAB dataset'}
          </a>
        </li>
        <li>
          <a href="?config=test_data/config_demo.json&session=share-oTyYRpz9fN&password=fYAbt">
            {'~1.5kb insertion in GIAB dataset'}
          </a>
        </li>
        <li>
          <a href="?config=test_data%2Fconfig_demo.json&session=share-rzJ27iixQH&password=rSgZe">
            {'~500bp insertion from SKBR3 PacBio reads'}
          </a>
        </li>
        <li>
          <a href="?config=test_data%2Fconfig_demo.json&session=share-LffYr8SI5E&password=VmZVl">
            {'Methylated and unmethylated CpG island with nanopore reads'}
          </a>
        </li>
        <li>
          <a href="?config=%2Fgenomes%2FGRCh38%2F1000genomes%2Fconfig_1000genomes.json&session=share-DN_h4SIwo4&password=CxkLw">
            {
              '1000 genomes structural variant call with large inversion on chromosome 19'
            }
          </a>
        </li>
      </ul>
    </div>
  )
}
