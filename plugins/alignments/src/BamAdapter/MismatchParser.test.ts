import {
  generateMD,
  getMismatches,
  cigarToMismatches,
  parseCigar,
  mdToMismatches,
  getNextRefPos,
  getModificationPositions,
} from './MismatchParser'

const seq =
  'AAAAAAAAAACAAAAAAAAAAAAAACCCCCCCCCCCCCCCCCCCCCCCCCGGGGGGGGGGGGGGGGGGGGGGGGGTTTTTTTTTTTTTTTTTTTTTTTTT'

// examples come from https://github.com/vsbuffalo/devnotes/wiki/The-MD-Tag-in-BAM-Files
// and http://seqanswers.com/forums/showthread.php?t=8978

test('cigar to mismatches', () => {
  expect(cigarToMismatches(parseCigar('56M1D45M'), seq)).toEqual([
    { start: 56, type: 'deletion', base: '*', length: 1 },
  ])
})

test('md to mismatches', () => {
  const cigarMismatches = cigarToMismatches(parseCigar('56M1D45M'), seq)
  expect(
    mdToMismatches('10A80', parseCigar('56M1D45M'), cigarMismatches, seq),
  ).toEqual([
    { start: 10, type: 'mismatch', base: 'C', altbase: 'A', length: 1 },
  ])
})

test('get mismatches', () => {
  // simple deletion
  expect(getMismatches('56M1D45M', '56^A45', seq)).toEqual([
    { start: 56, type: 'deletion', base: '*', length: 1 },
  ])

  // simple insertion
  expect(
    getMismatches(
      '89M1I11M',
      '100',
      'AAAAAAAAAACAAAAAAAAAAAAAACCCCCCCCCCCCCCCCCCCCCCCCCGGGGGGGGGGGGGGGGGGGGGGGGGTTTTTTTTTTTTTTTTTTTTTTTTTA',
    ),
  ).toEqual([{ start: 89, type: 'insertion', base: '1', length: 0 }])

  // contains a deletion and a SNP
  // read GGGGG--ATTTTTT
  //      |||||   ||||||
  //      GGGGGACCTTTTTT
  expect(getMismatches('5M2D6M', '5^AC0C5', 'GGGGGATTTTTT')).toEqual([
    { start: 5, type: 'deletion', base: '*', length: 2 },
    { start: 7, type: 'mismatch', base: 'A', altbase: 'C', length: 1 },
  ])

  // 0-length MD entries, which indicates two SNPs right next to each other
  // "They generally occur between SNPs, or between a deletion then a SNP."
  // http://seqanswers.com/forums/showthread.php?t=8978
  //
  // read GGGGGCATTTTT
  //      |||||  |||||
  // ref  GGGGGACTTTTT
  expect(getMismatches('12M', '5A0C5', 'GGGGGCATTTTT')).toEqual([
    { altbase: 'A', base: 'C', length: 1, start: 5, type: 'mismatch' },
    { altbase: 'C', base: 'A', length: 1, start: 6, type: 'mismatch' },
  ])

  // same as above but with the non-0-length MD string
  // not sure if it is entirely legal, but may appear in the wild
  expect(getMismatches('12M', '5AC5', 'GGGGGCATTTTT')).toEqual([
    { altbase: 'A', base: 'C', length: 1, start: 5, type: 'mismatch' },
    { altbase: 'C', base: 'A', length: 1, start: 6, type: 'mismatch' },
  ])
})

test('basic skip', () => {
  expect(getMismatches('6M200N6M', '5AC5', 'GGGGGCATTTTT')).toEqual([
    { base: 'N', length: 200, start: 6, type: 'skip' },
    { altbase: 'A', base: 'C', length: 1, start: 5, type: 'mismatch' },
    { altbase: 'C', base: 'A', length: 1, start: 206, type: 'mismatch' },
  ])
})

test('vsbuffalo', () => {
  // https://github.com/vsbuffalo/devnotes/wiki/The-MD-Tag-in-BAM-Files
  // example 1
  expect(
    getMismatches(
      '89M1I11M',
      '100',
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    ),
  ).toEqual([{ base: '1', length: 0, start: 89, type: 'insertion' }])

  // https://github.com/vsbuffalo/devnotes/wiki/The-MD-Tag-in-BAM-Files
  // example 2
  expect(
    getMismatches(
      '9M1I91M',
      '48T42G8',
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    ),
  ).toEqual([
    { base: '1', length: 0, start: 9, type: 'insertion' },
    {
      altbase: 'T',
      base: 'A',
      length: 1,
      start: 48,
      type: 'mismatch',
    },
    {
      altbase: 'G',
      base: 'A',
      length: 1,
      start: 91,
      type: 'mismatch',
    },
  ])
})

test('more skip', () => {
  expect(getMismatches('3M200N3M200N3M', '8A', 'GGGGGCATTTTT')).toEqual([
    { base: 'N', length: 200, start: 3, type: 'skip' },
    { base: 'N', length: 200, start: 206, type: 'skip' },
    { altbase: 'A', base: 'T', length: 1, start: 408, type: 'mismatch' },
  ])
  expect(
    getMismatches('31M1I17M1D37M', '6G4C20G1A5C5A1^C3A15G1G15', seq).sort(
      (a, b) => a.start - b.start,
    ),
  ).toMatchInlineSnapshot(`
    Array [
      Object {
        "altbase": "G",
        "base": "A",
        "length": 1,
        "start": 6,
        "type": "mismatch",
      },
      Object {
        "altbase": "C",
        "base": "A",
        "length": 1,
        "start": 11,
        "type": "mismatch",
      },
      Object {
        "base": "1",
        "length": 0,
        "start": 31,
        "type": "insertion",
      },
      Object {
        "altbase": "G",
        "base": "C",
        "length": 1,
        "start": 32,
        "type": "mismatch",
      },
      Object {
        "altbase": "A",
        "base": "C",
        "length": 1,
        "start": 34,
        "type": "mismatch",
      },
      Object {
        "altbase": "C",
        "base": "C",
        "length": 1,
        "start": 40,
        "type": "mismatch",
      },
      Object {
        "altbase": "A",
        "base": "C",
        "length": 1,
        "start": 46,
        "type": "mismatch",
      },
      Object {
        "base": "*",
        "length": 1,
        "start": 48,
        "type": "deletion",
      },
      Object {
        "altbase": "A",
        "base": "G",
        "length": 1,
        "start": 52,
        "type": "mismatch",
      },
      Object {
        "altbase": "G",
        "base": "G",
        "length": 1,
        "start": 68,
        "type": "mismatch",
      },
      Object {
        "altbase": "G",
        "base": "G",
        "length": 1,
        "start": 70,
        "type": "mismatch",
      },
    ]
  `)
})

test('clipping', () => {
  expect(getMismatches('200H10M200H', '9A', 'AAAAAAAAAC')).toEqual([
    { cliplen: 200, base: 'H200', length: 1, start: 0, type: 'hardclip' },
    { cliplen: 200, base: 'H200', length: 1, start: 10, type: 'hardclip' },
    { altbase: 'A', base: 'C', length: 1, start: 9, type: 'mismatch' },
  ])

  expect(getMismatches('10S10M10S', '9A', 'AAAAAAAAAAGGGGGGGGGC')).toEqual([
    { cliplen: 10, base: 'S10', length: 1, start: 0, type: 'softclip' },
    { cliplen: 10, base: 'S10', length: 1, start: 10, type: 'softclip' },
    { altbase: 'A', base: 'C', length: 1, start: 9, type: 'mismatch' },
  ])
})

test('md generation', () => {
  const query = `CACACTAGCCCGTCAGCGAACGCGTGCGCGGCCGCTGCCCTGCAGCGAATGGGGCTAACGACGCATAAAACGCCCGCATA
ACCACTCGAGCTACGGGAAATTCACTCAGGCTGTGTTGCTTCGACGTGTAGATCTCATTCACATATCATAATACCTCCAA
GACCAACGGCTGCTCATGACTCTCTTACCTTGTTAGGGACATTTCGGCACTAGGGAAGAGCTGAGGACTTTGAAAACGTC
GATAAAACCATCGCGGGAACTAGCCTGCGTTAGAACTCCCATATTTTACGGGTCGCAAGCTTGAGAGTCCTGTCCCGGCA
GCTGCAAGTGCTACGGCAGGAGGGGATCTACCATAACGTGCAGTAAGACCCCTGCCCGTAATGAGGCGGTACTCGTCTCT
AATCGTCAGTAGTTACTATGTCCGAGGACGTGCCTCTACGAGTTGAACTCTGGCTAGGCCCACCTGTCCGCGCCACTGCT
CGGGTACCCCATCTGCTTTATCCAACTTCACCTGCGCCTTAACGGAATCTCTGGTTGCCAGTCATCCGATGGTCATTAAG
CAGCGTGGTACATCGTAAGCCAATACTTCAGGGCGCCTAGCCATATTCCCAGCCAAGCGGCTGCATAATTACAAGCGCTG
GCACGACTAATCGATCCCACGAAGCCTGGGAGATGACCCTAGCCCTAAAAGTCTGCCCTCGTGACCTATCTGCCACGTGA
TACTTGATATATTTGTAATGAGCGGAGCAGGGTAGATGACTAATATACAGGGTCGTCTAGGTTTGCACGAATGCAGACAT
CATCCGCGCAAGGCCCGGACGGCTGTACTCACACAAGCGTAGGTCTCCATTCTCCCTCAGCCAGCACTAAGATTCCCACG
TGACCAGGGCGACGGGCCCTCAGCCAAACGTATACCTTGATATCTACTTAAGTCAAGGTTGACTCCGAACCCTATGGGTC
GGTGCCGTTAACAGGGAGTCTATAGTCTCGGCGTTTCCATTGTTGTTTCAAACTCCTGCTTATAAGGGTGAAAGCGCTGG
AGGGCATAGTTTATGCCCAAAGTTGCGCGTAGATCCGTCGGGATAGTGTGCTATAATAAGGACTGCTCGAGGTGTAGGCG
GTAACGGCTCCCGCCTTCAGTAGGGCGCGGAACTCGAATCGGAGTTACAGGACTTGACCCGAGTCATATCCAAGTTTATG
TTAGCCCGATCGGATCTCGGATGCTCGTATCTGCGACGAGGTCGAAGACGGACGAAATACGATTCAACCGCGCGAACCAT
TGCATCTAACCTTTAGCCTCAATGGGTGTTAACGTGGTGGTGCTCACTGGTCGTACTCTTTTGTGCAACTACTTCCAGTA
TGAACAACAGTCAAGTTGCGACATGATGCCTCTTTACGTGATTCCCACAGTTTCCCACCTCAGGATGCTTGCTTCTTTAG
CTAAACCCAATAGTTATGGCGGCCACCTTCAGACGTCCCACGAGGACGGCTATGACGTTGCTAAACGCATTCGCCGCCGA
AAGGTAGCGCTAACGAGTTCTGTAGAGTTTGTTCCGGGCCAGATCTCCAGGATGGTCGCAACAACGCAGTACCGGTTTTA
TACTGGTGAACCCTCTACCTGTTATTAAGTTTACAGCGTTGTCCTACGGTACATGGTCGTGAGTACTCGCGTAGTCAAAC
GCCAGGACTAGCAGCGAGAATTATTGGTCGCGATACTTACTACAATAACTTACCCGATATTGACAGTGCAGGGTTGAAAG
AGATGGACAGTTGAATATCTACTTTTGACGGAATCCTCAAAACTCCCTCCACCTACAGGTAACGGCCCTGTCCGGGACCG
CTTTCTTGCATATATTGGTTTCCACAGAGCGTATCTAAGTTAGTCTCTTGACCGTTCACCGACTCTAGGGCGACTCGTTA
TCGCCCTCCGAAACGATGCTATTCGTTACCTCAATGATGACAGTTGGTCAGACGTAAGTGATCCCAATCTCACTCGTGCC
TTGTCCACCAGTTCCGTGAAGACGAAGCAATACGCGGAATACGTGGCTTCGTAATATTTTGACGATATGGGGCTGGGACG
CTCAAGACTTCCAGTGACAAACAAAGTGAAGAGCAACTTGCATCCCTCATCATGACACTATTACCAGAGTAGCCGATGGA
TTAACGCTAATTTGGTCAGGGCAGCTATCGCATCCCGCAGGTGTAGGCGGAGACTTTTTTTTTTTGCGAGTTGACAGGTA
ATCTCACGGTATAAGCACGGTTATTTACGCAAGCGACGTCCCTGGGAGAATCCGCCCACGGTAGGACCCCATAATCCATA
AATACTGCGGTCGAAACCGTTCATATCGTGATCAGGAACCTGCTTTCTAGGGATGCGGTCCCCGCATTCAGAGTTCTACT
TTGGCCAGCGTGAGACGTTAACAACCCACTTACGCGGTACATTGAAGTCGTTCGAGTCCAGTGTGACCTGTGTACCGAAT
AACGTGTAGACCAGCGCGTCTACGACTTAGCGCGGCTCCACTCCAAAGCACCTTTTGGGACTTTGCCAACGAGCCTGTTG
GCCGTTAAGCGGTATTTGCACAAACTAGATCACCCTAGTGTCGGTAACCGACTCACCCTATTGGGATCATCGTGAGCTCG
AAACACTAGGCGGACCAACGGATGAGCATTTGATTCGGCTCTACAGAGCTTGTCGCCAGAGAAAAACTGTGGCAACTCTA
CGCTCGCGGGGAATTGACTTTAGCGGCCCCCTAGACAGGTGTGGGACACCTAGTCTAGATTCACGTCCTACACGACATAA
CAGCACCTTCCTGGCCAGCCCAGAAATATGTACCTGGACGACACTCCAGTCCTTCCGACGCCATAATGTGAGCCGTAGCG
CCCACGACGATCAACGAGGAGAAATTTACAAAGGCTAGTGTGAATGCTACGTCGTCTACCCATTGCTCCATCGAAACGAA
CGCAACGCACAGCATACAACGTTCTACCATGCCGGAGCGCGGATCCTCAAGTACAGAAAACAGTAGGTCTAAACATGATC
CGAACAAATCGGTAGGTTTACACAGCTACCTCCGTCCATATGGCGTACTGCATCGATCGTGCTTACTACGGTCATCGCCG
GCCCGCGATGCACGTACGAAGGAATACCCTGTCTGCCCCCGCGCGAGCTTACGCTGTCTCGCACATACCGAGCACTGTCG
CTTCGAAGCTAAACTATGAGCCCAGCCGAGCTCCTTATGGCCGCAACGCTGGTGCGCCAGTCTGATAAATTCCACACGTA
CACGATCCTCGTGTAAGATCTCGGGCAGTAGTAAGTCATTATCACATGGTTAGGAGATGATAGAATACATGGGTTCTGGT
AGCTACAACACAGGATTTGTGAACCCTTGGCCCTTTGGTGAGTGCTACAATAAAATTCTCCGTATGGGACTAACCTAAAG
GGTGCTGCGATTGACTTCCCGGCCCAGGTTAGATGTCCATATCATTCATACATTCCCGACCGACCCAATGCCTAAATCAG
AGGCGCCTTAGCTAGTTCTTGTATGTGTGCCACGATCCAGGCCACGCAGACACGACCCCTCGGCGAGTGATCACCATTAC
CGGATTTGGCATCGAAGTCTTTTTCTGGGAAGTTAGCCAGTTTGGTGTGCGGTGCTTAGAATCTTATTCCCAGTCAAACG
CCCCTGAGGACGAATTGCTATACCCTAGTTGCCACGCCGGAACCATCTTCGGGAGAGTAGACAAATCCGAGTTAGATATG
TTAGCGTCTTCGTGGAGTCTGAAATGTATCACTTCTACCAGCAGAATACGCGAATGTCTGTTTGCCCTGGATGAGCGGAA
TTGGCTTAAAAGCACAGACTACGAGCATTTTGAGTACGGTTCCATATCGCGATGTAATTACCTATACTAGGTTATCGCTA
GTACGAATAGCGAAGTACAGTGTAGCAGGCCCTTTGTTAGCAAGTTGCTCTAAACAGTTGTCAATACGTAGGCACAATAG
TGCGATATCTTCCTAAATCCGGGAAGCCATGGCGCTGGGCAGAATATCACATACGGAATAATCAACCTCCATATTTGGTT
CGTTTTACTCGATGAGTGCCCCTTGCTTGAGACGAGCGTTCTGAGTTGATGGCATGTCGAAAGGTTTACGCGGTGAGTAG
AGCACTCTTGACCCCTACAGATCGGAATCCTCGGAGGTAGGACAGTTGGAACTTCACAGTTAACCTTTGTTCGATTGCAT
GAAGGTTGTGTTCTGGGAGTAGGCTCCCAAGGTAGCGGTTCATGCCTGGGGGCAGCCCTAAGTTTGTATATATGTGAGTT
TGCGTCTGAACACATTATAGCATGAGGAAACGTAAGCTTTCTGGAGGGATCTTCTAAAGCCAGGTATCGCCCGCTACGAT
GCCGGAGCGCAGGGTGGATTCACAGCTACCTCGTGCCTCAAAGGCTTAAGGCTAATCCATAGCAACAGTGCGAAAGGACG
TCCTTTCAGATTTCGAAAGGTGCTGACACATACAAGGGTCAGGGCGGTCCTACCCTTCTGATGTCCCTACCTGGTTTTTT
AGCAAGGGTCAAGGCTAGGCTTATACTCCCGAACGCTTTAAACATCTATTCCCACCCCTGACGGGGGGAAGTTGCCGCGT
TAAGTATAAGAATAAGATTTAACAGTACACTTTAGGTTCCTCTTCCGCGAGCCGTCATACAGCACCGAGCGCCGTTGAAA
CGCAATTAACGCGTATTTGTCGCTGCGAAAAAAAAACGCTCGCCAGCATATTGGAGTGTCGACTTGAAATATTGAACAAC
ACCGCATATCAAGACGAATAGTAGGGCTTCACTACCTCCACCTGACGGCCCTAGGACTTATACTCGAAAAAGACCTTCCA
TCACGATGTCCCTTACCGGCGAGAGTGCTATAATACGCATGAATAGCAGATCTTGCCGTCGCTGAGTGTCACCCAGGGTT
GCTCCCAGAAAGAGATAGGGCGGAGAGCCATCGACAGCAGCTCTCGATCTAGGTGGTAGCAGGCTAAGGAGTCGTGTCGT
CGCGCCCGAGTTGGAACCATTATCGATGTACATCAATGCAGTGAATGATGCTGATAGACTCGGGAGTTTGCCTCAAAACC
CCAGAGTTACGTAGAAGACGCAGGTCTATTAGTTAGAAGGAGTCAGTATTGGCCTTTGAAAGATCTTATGCTCATGCCCT
AATCGTAGTTAAACGGCGAATCCGTGGAAGGCCAATCTGGCCGGTTTTGACCCCCGGACTCTTAAGACGTCCAATGTGGC
TAGACATAAGTCAACGAATTACCTATACCGAGGGCGGGAACCGGCCAATTTATTACGAGAGCACGAGAGCCTTGTAGCGA
CCCAGCACACTAGTCCTCGAGTCCCTCTCATCCTGAGACGTAGAATAGCATATACCGCCTAGGAGAGAATGAGCGCGTCT
AGGCTTCCGTCGCCCTCTCCGTCGTCTCGGGTGAACCGTAAGTCCTTCCGCATTCCCTTACCTCAAGCGCGTTGGTGTGA
AGTGGTATTGAGGCCCAGTCTCTATAACGCATATACTTGTGCACTCTATTACTTACCATGGGAACCAATGGCACTCTACG
AATCATGCTCACAGCTGAGCAACGGTGCTGCTCACCAATTACATATGAGCTCGTGGATTTAGCGTTGGAGCGGAACGATG
AATTTCCATCTGTTCGCGCGCATCCACTAATCCAATATACGGTTATCCCGAGCGCTACTAGTGTCTGACCGGGTTGGTAG
CCGAACCCTTTTGCAAGCCGCGCTTAGTGGATGTTGAAGTGGGAGTGATAAGCTTAAGCCGCCACGTTCGGGGGGGACTC
GTTTATATTGGTGCTGGAATTACGAACGGCGTGATTCGTAGTCGGCCCTAATCGGGCGCGACCGAACACATGTAGTACTG
TCGAGGCGGTTTAAACCCCCACAGTAGGTACTCTATCAGCAGAATTATGCTAGAAAGTTTCACACACAACTTTCCGCATG
AGGCTCATGCGGAGCGTCGCACTCCCAATGGCCAGTGCCGGTAGTCGATGTTTGGTCGGAACTTAGTTCCTTCGGAATAA
CGAACCGGATTTAAAAGAGCCTCAGGAGAACCTAAACGAATCCGTACGCATCTTGCCCAAGGTTGCTGAGCCTCGTCGCC
TTTCTCAGTTCCACCTACATTAATGCAATGCGTTCGAAGCTTGACCTGCAAACAGGAATCAAGTTCAGACAGAGTGCAAG
AGTTTCGCAGATAATTGGGAGACGACCCACTTGGATATAGGTGCTTTTTGAGATGTGTGTACGACCGTCCTTTCGAGCAT
ACCTACGGGTTACAATTGCTCCGGTAAGTCAGGCACATAGAAAACATAGCCACTACTGAGGTGTATCAAGATTACCTCAT
GTAGACTTGAAATACAGCACATCCGCTTTAAGCTTAACCGATGTAGAACAGCATTTTGGGCGGCGTTGACAGCGTGGCCC
GCTCACCGGTTTGCTCCCTTCTCACCAAATAACCAATGAGCACGACTTTGGTGACTGGACTGCCAGATGACGGCTACAAC
CCGTTTTTGGTTCCGAATTCCGCTCTAACTCAACTAACATCCATACTATATGCGCCAGGATATTCTCGCGGTTGGACCCC
CCTGCCAATTCGGGTTAAAACCACTCCGCACCCCCATGTAGGGGAGCTGGGCCCGCATTACAATATGCGAATCGATCCCG
CAGATGGACGCTCACAAAATTCAGTCCTTTCACGACTCCGCTCATATAGACGGTAGAAGGGATACTGAGGCTGTTAGATA
GGACGTCGAGCATGGCGTAGACGAGCGCAACCGGGTCGAAGGCCCGCATTACCGTGACACCCAGTTGAAAGGATTTACAC
TGCTTCATATCGATATTTACCACTTTGTAATTGGGAGCTCAAAGACCTAAGTCAACACGGACCATCATACAGGGTCGCCA
GTAAATGAGAAGCGCTGTCTGTGCCATGGAGAAGCGCTGCTACAGCACACAACGAACAATCTGCATGTGAAGGAGGGTGC
CTCTTTTGGGATGAGCCTACGGGGATGTGTATCCCATGCCCTGTAGGCAGTTGGGACTAGCGCCGAGCTAATCTAGTAAC
TAAGGCGCCAGCCGCGGCTGTTTGCCGAAGTCGTGCTGACTGCTGTACAACGAAGGGCGAGCGTGTTAACATGCCTACAC
GTTGACCTAGACTAGTCCAAGTTCTGAAAGTCCCATTAGGTCCGGGTAGTACAGTCCTCGGTTCCAGTCCCATCTTGTGC
CGCCAAGGACAAGCGATCATCAAAATCTGACTGAGTAATTGAATCAGCTACCTCAGACCACATTCAGCTCTCGGTAAACA
TGCGATGGCTTGTGGTTGCACCGTAAAAGGGGGAAGCCCATCCATCCTGTAACACCACAATCGCGCGTAGCTTAATAACG
GCTCCACCATTAGAATTCGATCGAGAGACACTGGTTTCAAGAGCCTTCCCTTTTGCTTTAGTGGGCCAAATCGCAACCCT
GCTCCCCTCCCTTACGCCTTATACACTTCAGTGCAAATTCATCGCGTTCGAGCGAACAACCTGGACTTCTGTTGTACGTA
GTCCACGGGGGCTTTATTCATTATAGAAAGCCCCCTACTGTACACCGTTTATCATGGTTCACATCATGAGCTGATCACCT
AGAGAGTCGTCATGCACATTCGCACTAACAAGGACATATGAGTAACCGGGAGAG`.replace(/[\r\n]+/gm, '')

  const target = `cacactagccccgtcagcgacggtgcgcggccgctgccctgcagcgaatggggctaacac
gcataaaacgcccgcataaccactcgagctacgggaattcactcaggctgttgcttcgac
gtgtagtctcattacataatcataatacctccaagaccaacggctgctcatgactctctt
accttgttagggacatttcggcactagggaagagctgaggactttgaaaacgtcgataaa
accatcgcgggaactagctgcgttagaactccatattttacgggtcgcaagcttgaggtc
ctgtcccggcagctgcaagtgctacggcaggaggggatctacctaacgtgcagtaacgag
cccctgcccgtaatgaggcgtactcgtctctaatcgtcagtaagttactatgtccgagga
cgcctctacgagttgaactctggctaggcccacctgtccgcgccctgctcgggtacccca
tctgcttatccaacttcacctcgccttacggaatctctggttgccagtcatccgatggtc
attaagcagcgtggtacatcgtagccaatacttcagggcgccagccatattcccagccaa
gcggctgcataattacagcgcctggcacgactaatcgatcccacaagcctggtagatgac
ccttagccctaaagcgccctctgacctatctgcacgtgatacttgattatttgtaatgag
cggacagggtagatgactaatatacagggtcgtctaggtttgcacaatgcagacatcatc
cgcgcaaggcccggacggctgtactcacacagctagctccatctccctcagcagcactaa
gattcccacgtgaccagggcgacgggcctcagccaaacgtatccttgatatctacttaag
tcaaggttgactccgaaccctatgggtcggtgccgttaacagggagtctatatctcggcg
ttccattgcttgtttcaaactcctgctataaggtgaaagcgctggagggcatagtttatg
cccaaagttgcgcgtagatccgtcgggatatgtgctataataaggactgctcgaggtagg
cggtaacggctcccgccttcagtaggcgcggaactcgaatcggagttacaggacttgacc
gagtcatatccaagtttatgttacccgatcggatccggatgctcgtatctgcgacgaggt
cggaagacggacgaaatacgattcaaccgcgcgaaccattagcatctaacctttagcctc
aatgggtgttaacgtggtgggctcactcggcgtactctttgtgcaactattccgtatgaa
caacagtcaagttgcgacatgatgctcttacgtgattcccacagtttcccacctcaggat
gctttctttagctaaacccaatagttatggcggcaccttcagactcccacgaggacggct
atgacgttgctaaaccattcgccgccaaaggctagcgctaacgagttctgtgagtttgtt
ccgggccagatctccaggatggtcgcaacaacgcagtaccggttttatactggtgaccct
ctacctgttattaagttacagcgttgtcctacgtacatggtcgtgagtactcgcgtagtc
aaacgccaggactagcagcgagaattattgtcgcgatacttactacaatacttacccgat
attgacgtgcagggttgaaagagatggacagttgaatatctattttgacggaatcctcaa
aactccctccacctcaggtaacggccctgtccgggaccgcattcttgcatatattggttc
ccagagcgtatctaagttagtctcttgaccgttcaccgactctagggcgactcgttatcg
ccctccgaaacgatgctttcgttacctcaatgatgacaggctgtaacgtaagtgatccca
atctcactcgtgccttgtccaccgttccgtgaagacgaagcaatacgcggaatacgtggc
ttcgtaatattttgacgatatggggctgggacgctcaagacttccatgacaaacaaagtg
aagagcaactgcatccctcatcatgatcactattaccagagtagcgatggataacgctaa
tttggtcagggcagctatcgcatcccgcaggtgtaggcggagactttttcttttgttgcg
agttgacaggtaatctcacggtataagcacggttatttacgcaagcgacgtccctgggag
aatccgcccacgtaggaccccataatccataaatactgcggtcgaaaccttcatatcgtg
acagaaccgctttctagggatgcggtccccgcattcagagttctactttggccagcgtga
gacttaacaactccacttacgcggtacattgaagtcgttcagtccagtgtgacctgtgta
ccgaataacgtgtagaccagcgcgtctacgacttagcgcggctccactccaaagcacctt
ttgggactttccaacgagcctgttggccgttaagcggtatttcacaaatagatcacccta
gtgtcggtaaccgactaccctattgggatcatcgtgagctcgaaacactagaggcggacc
aacggatgacatttgattcggctctacagagcttgtcgccagagaaaaactgtggcaatc
tacgctcgcggggaattgactttagcggcccctagacaggtgtgggacactagtctagat
tcacgtcctacacgacataacagcaccttcctggccagcccagaaatagtacctggacga
catccagccttccgacgccataatgtgagccgtagcgcccacgacgatcaacgaggagaa
atttacaaaggctgtgtgaatgctacgtcgtctaccattgctcatcgaaacgaacgcaac
gcacagcatacaacgtttaccatgccggagcgggatcctcaagtacagaaaacagaggtc
taaacatgatccgaacaaatcggtaggtttacacagctacctcgtccattggcgtactgc
atcgatcgtgcttactacggtcatgccggcccgcgatgcacgtacgaaggaataccctgt
ctgcccccgcgcgagttacgctgtctcgcacataccgagcactgtcgttcgaagctaaac
tatgagcccagccgagctccttatggccgcaacgctggtgcggccagctgataaattcca
cagtacacgatcctcgtgtaagatctcgggcatagtaagtcatttcacatggttaggaga
gatagaatacatggttctggtagctcaaccaggatttgtggaacccttggcccttggtga
gtgctacaataaaattctccgtatgggacaaccaaagggtgctggatgtgacttcccggc
ccaggttagatgtccatatcattcatacattgcccgaccgacccaatgcctaaatcagag
gcgccttagctagttcttgtagtgtgccacgtccggccacgcagacacgaccctcggcga
gtgatcaccattaccggattggcatcgaagtctttttctgggaagttagccagtttggtg
tgcggtgcttagaatcttattcccagtcaaacgcccctgggacgaattgctaaccctagt
tgccacgccggaaccatcttcgggagagtagacaaatccgagttagatatgttagcgtct
tcgtgagtctgaaatgtatcacttcaccgcagaatacgcgaatgtctgtttgccctggac
tgacggaattggcttaaaagccgactagagcattttggtacggttcctatccgcgatgta
attacctatctaggttatcgctagacgaatagcgagtacagtgtagcaggccctttgtta
gcaagttgctctaaacagttgtcaaaacgtaggcacaatagtgcgattcttctaaatccg
ggaagctcatggcgctgggcagaaatatcacatacgggaataatcaacctccattttggt
tcgttttactcgatgagtgccccttgcttgagacgagcgttctgagttgatggcatgtcg
aaaggtttacgcggtgagtagagcactttacccctacagatcggaatcctcgaggaggac
agttggaacttcacattaacctttgttcgattgcatgaaggttgtgttctgggagtaggc
tcccaaggtagcggttcatgctgggggcagccctaagtttgtattatgtgagtttgcgtc
tgaaactacatttagcatgaggaacgtaagctttctggagggatcttctaaagccaggta
tcgcccgctacgatgccggagccggtggttcacagctacctgtgctcaaaggcttaaggc
taatcatagcaacagtgcgaaaggacgtctttcagatttcgaaaggtgctgacacaacaa
gggtcagggcggtcctacccttctgattccctacctggttttttagcaagggtcaaggct
aggcttatactcccgaacgctttaaacactatcccacccctgacggggggaagttgcgcg
ttaagtataagaataagatttaacagtacactttaggttcctcttccgcgagccgtcata
cagcaccgagcgccgttgaaacgcgattaacgcgtattgtcgtgcgaaaaaaaaacgctc
gccagcatattggagtgtcgacttgaaatattgaacaacaccgcatatcaaggacgaata
gtagggcttcactacctccacctgacggccctaggacttatactcgaaaaagaccttcca
tcacgatgtcccttaccggcgagagggctatatacgcatgaatagcagatcttgccgtcg
ctgagtgtcacccagggttgctccagaaaggagatagggcggagagccatcgacagcagc
tctcgtctaggtggtagcagctaaggagtcgtgtcgtcgcgccgagttggaacattatcg
atgtacatcaatgcagtaatgatgctgatagactcgggagtttcctcaaacccagagtta
cgagaagacgcaggtctatcagttagaaggagtcagtattggcctttgaaagatcttatg
ctcatgcccaatcgtagttaaacgcgaatcgggaaggccaatctggcggttttgaccccc
ggactcttaagacgtccaatgtggctagacataagtaacgaattactctataccgagggg
cgggaaccggccaatttattacgagagcacgagagccttgtagcggccagcacactatcc
tcgagtccctctatcctgagacgtagatatacatatacgcctagagagaatagccgtcta
ggcttccgtcgccctctccgtcgttcgcgtgaaccgtaagtcttccgcattcccttcctc
aagcgcgttggtgtgagagtggtattgaggcccagtcttataacgcatatacttgtgcac
tctattacttaccatgggaaccaatggcactctcgaatcatgctcacagctgagcaacgg
tgctgctcaccaattacatatgagtcgtggtttagcgttggagcggaagatgaatttcca
tctgttcgcgcgcatcactaaccaatatacggttatcccagcgctatctagttctgaccg
ggttggtagcgaacccttttgcaagccggcttagtggatgtgaagtgggagtgataactt
aagccgccacgttcgggggggactcgtttatattggtgctggaatacgaacggcgtgatt
cgtagtcgccctaatcgggcgcgacaacacatgtagtactgtcgaggcggtttaaaccca
cagtaggtactctatcagcagaattatgctagaagtttcacaacaactttccgcatgagg
ctcagcggcagcgtcgcactcccaatggccagtgccggtagcgatgtttggtggaattag
ttccttcggaatacgaaccggatttaaagagcctcggagaacctaaacgaatccgtacgc
atcttgcccaaggtgctgagccttgtcgcctttctcagttccacctacattaatgcaatg
cgttcgaagctctgaccgcaaacaggaatcaagttcagacagagtgcaagagtttcgcaa
taattgggaacgacccacttgatataggtgcttttagagatgtgtgtacgaccgtccttc
gagcatacctacgggttacaattgctccggtaagtcaaggcacatagaaaacatagccaa
ctgagagtgtatacaagattacctcatgtagactgaaatacacacatcgctttaagctct
caaccgatgtagaacagattttgggcggcgttgacagcgtgcccgctcaccggtttgctc
ccttctcaccaaataaccatgagacgactttggtgactggactgccagatgacgggctac
aaccgttttggttccgaattcgctctaactcaactaacatcatactatatgcgccaggat
attctcgcggttggacccccctgccaattcgggttaaaaccactccccccatgtagggag
ctgccgcaattacaatatcgacgatcccagatggacgctcacaaaatatcagtcctttca
cgatccgctcatatagacggatgaagggactgaggctgttagatagtgacgtcgagcatg
gcgtagacgagcgcaaccgggtcgaggcccgcattaccgtgacacccagttgaaaggatt
tacactgcttcattcgatatttaccactttgtatgaggagctcaacctaagtcaacacgg
accatcatacaggtcgccagtaatgagaaggctgctgtgccatggagaagcgctgctaca
gcacacaacgaacatcttgcaatgtgaaggagggtgctcttttgggatgagcctacgggg
atgtgtatccctgccctgtaggcagttgggacttagcgcgactatctagataactaaggc
gccagccgcggctgtttgccgaagtcgtgctgatgctgtacaacgaagggcgagcgtgtt
aacatgctacacgttgacctagactagtccaagtctgaaagtcccaatttaggtcgggta
gtacagtcctcggttccagtcccatgttgtgccgacaaggacaagcgatcatcaaatcga
ctgaaattgaatcagctacctcagaccacattcagctctcggtaacatgggaggcttgtg
gttgcaccgtaaaagggggatagcccatccatcctgtaaacctacaatcgcgcgtagctt
aatacgctcacattagacattcgatcgagagacctggtttcaagagccttcccttttgct
ttagtgggccaaatcgcaaccctgctcccctcccttacgccttatacacttcagtgcaaa
ttcatgcgttcagcgaacaactggacttctgttgtacgtagtccacgggggcttattcat
tatagaaagccccctactgtcaccgttatatggttcacacatgagctgatcacctagaga
gtcgtcatgcacattcgcctaacaaggacatatgagtaaccgggaggg`.replace(/[\r\n]+/gm, '')
  const cigar = `8M1D10M1I3M1I36M1I37M1I13M2I18M1I7M1I4M1D119M1I13M1I27M1I46M1I13M1D2M1D19M1I22M1
D19M2I43M1I21M1I16M1I6M1I55M1I20M1I34M1I4M1D23M1I18M1D10M3I8M1I11M1I15M1I17M1I41
M1I45M1I3M1I3M2I5M1I10M1I35M1I16M1I70M1I8M1I8M1D17M1I5M1I59M1I25M2I29M1I34M1I25M
1I12M1I26M1D38M1D39M1I17M1I12M1I4M1I31M1I3M1I36M3I30M1I11M1I31M1I36M1I64M1I20M1I
17M1I57M1I20M1I17M1I36M1I32M1I45M2I78M1I22M2I44M1I83M1I23M1I17M1D17M1I7M1I57M2D8
1M1I38M1I12M1I2M1I5M1I55M1I8M1D28M1I90M1I32M1I6M1I28M1I33M2D18M1I49M1I30M1I21M1I
59M1I14M1I5M1I66M1I21M1I8M1I35M1I15M1I23M1I47M1I7M1I35M1I51M1I32M1I54M1D5M1I15M1
I30M1I12M1I16M1I12M1I13M1I4M1I10M1D13M1I36M1I4M1I11M1I3M1D43M1D49M1I10M1I3M1I16M
1I28M1I81M1I13M1I72M1I21M1I3M1I31M1D3M1I17M2I7M1I10M1I10M1I3M1D18M1I15M1I10M1I73
M1I4M1I15M1D15M1D12M1D18M1I91M2I26M1I4M1I20M1I65M1I24M1I20M2D6M1I10M1I60M3I6M1I1
3M1I3M1I20M1I24M1I28M1I31M1I61M1I3M1I25M1I100M1I6M1I69M1D99M1I51M1I7M1D35M1I14M1
I22M1I11M1I25M1I26M1I7M2I12M1I67M1I14M1I7M2I16M1I50M1I10M1D9M1D48M1I12M1I15M1I15
M1D3M1I6M1I6M1I8M1I3M1I30M1I17M1I15M1I20M1D21M1I55M1I51M1I6M1I18M1I27M1I6M1I18M1
I7M1D5M1I17M1I19M1I12M1I17M1I47M1I23M1I18M2I31M2I36M1I10M1I22M1I4M1D32M1I11M1I4M
1I16M1I13M1I10M1I38M1I58M1D5M1I42M1I10M1I11M1I37M1I39M1D22M2I6M1D6M1D20M1I9M1I5M
1I9M2D19M1I23M1I38M1I5M1I30M1D10M2I16M1I20M1I65M4I10M1I8M3I4M1D10M1I3M2I6M2I20M1
D15M1I25M2I18M1D37M1I49M1I20M2I2M1D8M3I27M1I10M1I9M1I4M1I46M1D15M1I35M1I21M1D5M1
I3M1I2M1I6M1D43M1I33M1I27M1I13M2D6M1I59M1I5M1I6M2I39M1I9M1I28M1D43M2I5M2I8M1D15M
1I92M1I6M1I9M1I32M1I28M1I5M1I4M1I10M1I39M1I30M`.replace(/[\r\n]+/gm, '')

  expect(generateMD(target, query, cigar)).toBe(
    '8^C128^A218^C2^G41^A218^C31T9^T10G0C293^C232^G38^A46C1G176A2G1C308A19C99C1G0T0A161^T81^TC4G196^T217^AG590^G117^G67^G43^G327^C21C28^C94A40^T15^A12^G112T155^AC0T75C301G86^G93G63^G169C70G75^T9^G48G41^T59C48^G209^T261^C134T47^C83A60^A28^A6^A43^CT2C112^G10G122^A39^A32A0T24^T108^A98T0C0T3^A71^T16^A116^AT37G8A74G30^T18A0C1T21C4A7^C268G1',
  )
})

test('getNextRefPos basic', () => {
  const cigar = '10S10M1I4M1D15M'
  const cigarOps = parseCigar(cigar)
  const iter = getNextRefPos(cigarOps, [5, 10, 15, 20, 25, 30, 35])
  const [...vals] = iter
  expect(vals).toEqual([-5, 0, 5, 10, 14, 20, 25])
})
test('getNextRefPos with many indels', () => {
  const cigar = '10S4M1D1IM10'
  const cigarOps = parseCigar(cigar)
  const iter = getNextRefPos(cigarOps, [5, 10, 15])
  const [...vals] = iter
  expect(vals).toEqual([-5, 0, 5])
})

test('getModificationPositions', () => {
  const positions = getModificationPositions(
    'C+m,2,2,1,4,1',
    'AGCTCTCCAGAGTCGNACGCCATYCGCGCGCCACCA',
  )
  expect(positions[0]).toEqual({ type: 'm', positions: [6, 17, 20, 31, 34] })
})
