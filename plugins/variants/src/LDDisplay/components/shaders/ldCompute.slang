// LD matrix compute — UNPHASED (genotype dosages). One thread per
// lower-triangular cell (i > j); each writes one r / r2 / D' value.
//
// Dosages arrive as three bit planes — het, homAlt, valid — one bit per sample,
// so a pair reduces to nine popcounts per 32 samples rather than a loop over
// every sample. The six moments the statistics need (n, the two dosage sums,
// the two sums of squares, and the cross product) are all recoverable from the
// nine counts because a dosage is 0, 1 or 2: a het contributes 1 to a sum and 1
// to a sum of squares, a hom-alt contributes 2 and 4. So nothing is
// approximated by the packing; it is the same arithmetic with the per-sample
// loop factored out, and the counts are integers, which makes this kernel agree
// with calculateLDStatsDosageBits to the last bit rather than to a tolerance.
//
// This mirrors what ldPhasedCompute.slang does with haplotype planes, and the
// two now cost almost exactly the same: nine popcounts per word here against
// its eight. Phasing a cohort therefore changes which estimator runs, not what
// the matrix costs — unlike the sample-by-sample distance build, where the
// haplotype split doubles n and so quadruples the work.
//
// WebGPU-only: WebGL2 is GLES 3.0 and has no compute stage. The fallback is
// not a GLSL variant of this shader but the CPU path in getLDMatrix.ts, which
// also runs below the MIN_WORK threshold where dispatch overhead dominates.
//! targets: wgsl

import ldUniforms;

struct LDComputeUniforms {
  uint numSnps;
  // Words per plane, ceil(numSamples / 32). The sample count itself is not
  // needed: every count this kernel forms is masked by a `valid` plane, so
  // padding bits in the last word are zero and cannot contribute.
  uint numWords;
  uint ldMetric;
  uint signedLD;
  // Pair-separation window; see decodeBanded in ldUniforms.
  uint band;
  // Threads per dispatch row (workgroupsX * WORKGROUP_SIZE_X); see
  // bandedCell in ldUniforms for why the grid is 2D.
  uint dispatchRowStride;
};

[[vk::binding(0, 0)]] StructuredBuffer<uint> genotypes;
[[vk::binding(1, 0)]] RWStructuredBuffer<float> ldOut;
[[vk::binding(2, 0)]] ConstantBuffer<LDComputeUniforms> u;

// Layout per SNP: [het[0..numWords-1], homAlt[0..numWords-1],
//                  valid[0..numWords-1]]
// `het` and `homAlt` are disjoint subsets of `valid`; dosage 0 is a sample in
// `valid` and in neither, and a missing call is in none of the three.
uint getWord(uint snp, uint arr, uint word) {
  return genotypes[(snp * 3u + arr) * u.numWords + word];
}

[shader("compute")]
[numthreads(64, 1, 1)]
void computeLD(uint3 gid: SV_DispatchThreadID) {
  uint k;
  uint2 ij;
  if (!bandedCell(gid, u.dispatchRowStride, u.numSnps, u.band, k, ij)) {
    return;
  }
  uint i = ij.x;
  uint j = ij.y;

  uint n = 0u;
  uint het1 = 0u;
  uint homAlt1 = 0u;
  uint het2 = 0u;
  uint homAlt2 = 0u;
  uint hetHet = 0u;
  uint hetHom = 0u;
  uint homHet = 0u;
  uint homHom = 0u;

  for (uint w = 0u; w < u.numWords; w += 1u) {
    uint h1 = getWord(i, 0u, w);
    uint m1 = getWord(i, 1u, w);
    uint v1 = getWord(i, 2u, w);
    uint h2 = getWord(j, 0u, w);
    uint m2 = getWord(j, 1u, w);
    uint v2 = getWord(j, 2u, w);
    // Each of i's own counts is masked by j's validity and vice versa, so every
    // moment is formed over the SAME set of samples — the pairwise-complete
    // set. Counting i's hets over i's validity alone would mix sample sets and
    // the correlation would not be a correlation.
    n += countbits(v1 & v2);
    het1 += countbits(h1 & v2);
    homAlt1 += countbits(m1 & v2);
    het2 += countbits(h2 & v1);
    homAlt2 += countbits(m2 & v1);
    hetHet += countbits(h1 & h2);
    hetHom += countbits(h1 & m2);
    homHet += countbits(m1 & h2);
    homHom += countbits(m1 & m2);
  }

  float count = float(n);
  // Dosage 0 contributes nothing to any sum, so the sums are built from the het
  // and hom-alt counts alone: g = 1 contributes 1 and 1*1, g = 2 contributes 2
  // and 2*2, and a cross product is the product of the two dosages.
  float s1 = float(het1 + 2u * homAlt1);
  float s2 = float(het2 + 2u * homAlt2);
  float s1sq = float(het1 + 4u * homAlt1);
  float s2sq = float(het2 + 4u * homAlt2);
  float sprod = float(hetHet + 2u * hetHom + 2u * homHet + 4u * homHom);

  if (!ldEnoughGenotypes(count)) {
    ldOut[k] = 0.0;
    return;
  }

  float pA = ldGenotypeAlleleFreq(s1, count);
  float pB = ldGenotypeAlleleFreq(s2, count);
  if (!ldLociPolymorphic(pA, pB)) {
    ldOut[k] = 0.0;
    return;
  }

  // The three statistics are authored in ldUniforms.slang and `//! js-export`ed
  // into @jbrowse/ld-core, whose calculateLDStats is this kernel's CPU
  // fallback — picked by GPU availability and by a work threshold, so the two
  // run on the same data and their answers are read as one number.
  float r = ldGenotypeCorrelation(s1, s2, s1sq, s2sq, sprod, count);
  float D = ldGenotypeD(s1, s2, sprod, count);
  ldOut[k] = ldFinalize(r, ldRSquared(r), D, pA, pB, u.ldMetric, u.signedLD);
}
