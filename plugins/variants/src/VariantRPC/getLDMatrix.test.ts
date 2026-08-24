import { fillEncoded } from './getLDMatrix.ts'

// The genotype -> dosage encoding the composite (unphased) LD path runs on.
//
// This file used to be 615 lines that tested nothing: it carried hand-copied
// reimplementations of `encodeGenotypes`, `calculateLDStats`, `isPhased`,
// `encodePhasedHaplotypes` and `calculateLDStatsPhased`, and asserted against
// those. The copies had drifted — the encoder read `./1` as a het where the
// shipped `fillEncoded` reads it as missing — so the suite was green while
// describing behavior the app does not have.
//
// The statistics are not this plugin's code and are tested where they live:
// `calculateLDStatsDosageBits`/`packDosages` and
// `calculateLDStatsPhasedBits`/`packHaplotypesWithCounts` in `packages/ld-core`
// (including a brute-force fuzz across multi-word sample counts), and phase
// detection in `../shared/detectPhased.test.ts`. What is
// genuinely local is the encoding below, and `getLDMatrixMaf.test.ts` drives the
// whole of `getLDMatrix` through a mocked adapter for the end-to-end rules.

function encode(genotypes: Record<string, string>, samples: string[]) {
  const out = new Int8Array(samples.length)
  const counts = fillEncoded(out, genotypes, samples, {})
  return { encoded: [...out], ...counts }
}

const samples = ['s1', 's2', 's3', 's4']

describe('fillEncoded dosages', () => {
  it('encodes the three called diploid classes and a no-call', () => {
    expect(
      encode({ s1: '0/0', s2: '0/1', s3: '1/1', s4: './.' }, samples).encoded,
    ).toEqual([0, 1, 2, -1])
  })

  it('encodes phased genotypes the same as unphased ones', () => {
    // The composite estimator runs on dosage, which the separator does not
    // change; the phased path is a different function entirely (packHaplotypes).
    expect(
      encode({ s1: '0|0', s2: '0|1', s3: '1|0', s4: '1|1' }, samples).encoded,
    ).toEqual([0, 1, 1, 2])
  })

  it('reads any non-ref allele as alt at a multiallelic site', () => {
    // 1/2 carries no reference allele, so it is hom-alt on the dosage scale
    // even though the two alleles differ.
    expect(
      encode({ s1: '0/2', s2: '1/2', s3: '2/2', s4: '0/0' }, samples).encoded,
    ).toEqual([1, 2, 2, 0])
  })

  it('reads multi-digit allele indices, not just their first digit', () => {
    expect(
      encode({ s1: '0/10', s2: '10/10', s3: '0/0', s4: '10/2' }, samples)
        .encoded,
    ).toEqual([1, 2, 0, 2])
  })

  // The contract `fillEncoded` shares with packHaplotypesWithCounts, and the
  // exact case the deleted copy got wrong: one called allele does not pin the
  // dosage down, so the genotype is missing — but the allele it does report
  // still counts toward the MAF totals.
  it('encodes a half-call as missing while still counting its called allele', () => {
    const { encoded, nCalledAlleles, nAltAlleles, nValid } = encode(
      { s1: '0/0', s2: './1', s3: './0', s4: '0/0' },
      samples,
    )
    expect(encoded).toEqual([0, -1, -1, 0])
    expect(nValid).toBe(2)
    expect(nCalledAlleles).toBe(6)
    expect(nAltAlleles).toBe(1)
  })

  // Routine on chrX non-PAR / chrM. Dosage is pseudo-diploid so the composite
  // correlation stays on one scale, but the allele totals see the one allele
  // that was actually called — a haploid alt must not weigh twice a female's.
  it('codes a haploid call pseudo-diploid but counts one allele', () => {
    const { encoded, nCalledAlleles, nAltAlleles } = encode(
      { s1: '0', s2: '1', s3: '0/0', s4: '1/1' },
      samples,
    )
    expect(encoded).toEqual([0, 2, 0, 2])
    expect(nCalledAlleles).toBe(6)
    expect(nAltAlleles).toBe(3)
  })

  it('handles polyploid calls', () => {
    expect(
      encode({ s1: '0/0/0', s2: '0/0/1', s3: '1/1/1', s4: './././.' }, samples)
        .encoded,
    ).toEqual([0, 1, 2, -1])
  })

  // @gmod/vcf's two spellings of "this sample has no genotype": an absent key
  // (the record's FORMAT declares no GT column) and an empty string (the
  // sample's fields stop before GT's). Reading `.length` off the first threw;
  // the second split to [''] and counted as a called alt allele.
  it('treats an absent or empty genotype as a no-call', () => {
    const { encoded, nValid, nCalledAlleles, nAltAlleles } = encode(
      { s1: '0/0', s2: '0/1', s4: '' },
      samples,
    )
    expect(encoded).toEqual([0, 1, -1, -1])
    expect(nValid).toBe(2)
    expect(nCalledAlleles).toBe(4)
    expect(nAltAlleles).toBe(1)
  })
})

describe('fillEncoded genotype-class counts', () => {
  // The HWE filter reads these three plus nValid, so they have to partition the
  // called samples exactly.
  it('partitions the called samples across the three classes', () => {
    const { nHomRef, nHet, nHomAlt, nValid } = encode(
      { s1: '0/0', s2: '0/1', s3: '1/1', s4: './.' },
      samples,
    )
    expect({ nHomRef, nHet, nHomAlt }).toEqual({
      nHomRef: 1,
      nHet: 1,
      nHomAlt: 1,
    })
    expect(nValid).toBe(nHomRef + nHet + nHomAlt)
  })

  it('counts nothing for a site where every sample is a no-call', () => {
    expect(encode({ s1: './.', s2: '.', s3: '', s4: './.' }, samples)).toEqual({
      encoded: [-1, -1, -1, -1],
      nHomRef: 0,
      nHet: 0,
      nHomAlt: 0,
      nValid: 0,
      nCalledAlleles: 0,
      nAltAlleles: 0,
    })
  })
})

describe('fillEncoded split cache', () => {
  // The cache is keyed by the genotype string and shared across every variant
  // in the fetch, so a stale or mis-keyed entry would silently mis-encode whole
  // rows rather than throw.
  it('reuses a cached split without changing the answer', () => {
    const splitCache: Record<string, string[]> = {}
    const first = new Int8Array(samples.length)
    fillEncoded(first, { s1: '0/0/1', s2: '1/1/1' }, ['s1', 's2'], splitCache)
    expect(Object.keys(splitCache).sort()).toEqual(['0/0/1', '1/1/1'])

    const second = new Int8Array(2)
    fillEncoded(second, { s1: '1/1/1', s2: '0/0/1' }, ['s1', 's2'], splitCache)
    expect([...second]).toEqual([2, 1])
  })
})
