import { syntenyMateLabel } from './syntenyRowAdornment.ts'

// hg19 is an alias of GRCh37 in this session; every other name is canonical
const assemblyManager = {
  getCanonicalAssemblyName: (name: string) =>
    name === 'hg19' ? 'GRCh37' : name,
}

const label = (
  trackAssemblyNames: string[],
  viewAssemblyNames: string[],
  adapterType = 'PAFAdapter',
) =>
  syntenyMateLabel({
    trackAssemblyNames,
    viewAssemblyNames,
    adapterType,
    assemblyManager,
  }).label

test('a pairwise track names its one mate, from either end', () => {
  expect(label(['mm10', 'hg38'], ['hg38'])).toBe('vs mm10')
  expect(label(['hg38', 'mm10'], ['hg38'])).toBe('vs mm10')
})

test('a mate reached through an alias is named canonically', () => {
  expect(label(['hg19', 'hg38'], ['hg38'])).toBe('vs GRCh37')
  // and the anchor resolves too: the track names the alias of the view's own
  // assembly, so there is no mate left and it is a self-alignment
  expect(label(['hg19', 'GRCh37'], ['hg19'])).toBe('self-alignment')
})

test('a self-alignment has no mate to name', () => {
  expect(label(['hg38', 'hg38'], ['hg38'])).toBe('self-alignment')
})

test('several declared mates are counted, not listed', () => {
  expect(label(['hg38', 'mm10', 'rn7'], ['hg38'], 'MCScanBlocksAdapter')).toBe(
    'vs 2 assemblies',
  )
})

// The one case where reading assemblyNames would state something false: in a
// plain LGV an all-vs-all file draws against every sample in it, listed or not,
// so the label must not name the listed ones.
test('an all-vs-all track claims only what it can keep', () => {
  expect(
    label(['grape', 'peach', 'cacao'], ['grape'], 'AllVsAllPAFAdapter'),
  ).toBe('vs all samples')
  // two loaded assemblies is not a pairwise file: counting the list would get
  // exactly this case wrong
  expect(
    label(['grape', 'peach'], ['grape'], 'AllVsAllIndexedPAFAdapter'),
  ).toBe('vs all samples')
})

test('the detail line says what the row cannot', () => {
  expect(
    syntenyMateLabel({
      trackAssemblyNames: ['grape', 'peach'],
      viewAssemblyNames: ['grape'],
      adapterType: 'AllVsAllPAFAdapter',
      assemblyManager,
    }).detail,
  ).toMatch(/not configured as assemblies/)
})
