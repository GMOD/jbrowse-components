import { featureRefNames } from './featureRefNames.ts'

// Regression: the relevant-regions toggle narrows the circular view to the
// refNames these return. Anything missed here is a chord whose endpoint block
// gets filtered away, so the chord silently stops being drawn.
//
// Two entries, the record's own refName and its mate's — the same `svMateLocus`
// the chord's far end is drawn at, so the two cannot disagree about which
// chromosomes a callset touches.

test('a BND mate refName comes from the ALT breakend string', () => {
  // pbsv.BND.1:10002-11:176164, from the shipped HG002 subset
  expect(
    featureRefNames({
      uniqueId: 'vcf-0',
      refName: '1',
      start: 10001,
      end: 10002,
      ALT: [']11:176164]A'],
      INFO: { SVTYPE: ['BND'] },
    }),
  ).toEqual(['1', '11'])
})

test('a symbolic translocation reads INFO.CHR2, which is an array', () => {
  // sniffles <TRA> record: INFO values from @gmod/vcf are arrays even for
  // Number=1 fields, so a plain `INFO.CHR2` read yields ['MT'], not 'MT'
  const refNames = featureRefNames({
    uniqueId: 'vcf-1',
    refName: '1',
    start: 564463,
    // a <TRA> spans no reference on its own contig, so VcfFeature gives it
    // start + REF.length rather than the cross-contig INFO.END
    end: 564464,
    ALT: ['<TRA>'],
    INFO: { SVTYPE: ['TRA'], CHR2: ['MT'], END: [3916] },
  })
  expect(refNames).toEqual(['1', 'MT'])
  expect(typeof refNames[1]).toBe('string')
})

test('an explicit mate field is used for BEDPE-style features', () => {
  expect(
    featureRefNames({
      uniqueId: 'bedpe-0',
      refName: 'chr1',
      start: 100,
      end: 200,
      mate: { refName: 'chr5', start: 500, end: 600 },
    }),
  ).toEqual(['chr1', 'chr5'])
})

test('an intra-chromosomal SV contributes only its own refName', () => {
  expect(
    featureRefNames({
      uniqueId: 'vcf-2',
      refName: 'chr10',
      start: 308919,
      end: 312916,
      ALT: ['<DEL>'],
      INFO: { SVTYPE: ['DEL'], END: [312916] },
    }),
  ).toEqual(['chr10', 'chr10'])
})

test('a plain BED feature has no mate', () => {
  expect(
    featureRefNames({
      uniqueId: 'bed-0',
      refName: 'chr2',
      start: 10,
      end: 20,
    }),
  ).toEqual(['chr2', undefined])
})
