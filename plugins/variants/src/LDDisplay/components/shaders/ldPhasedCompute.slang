// LD matrix compute — PHASED (haplotype bitsets). One thread per
// lower-triangular cell (i > j); haplotype calls are packed one bit per
// sample, so each pair reduces to popcounts over the two haplotype planes
// rather than the per-sample loop the unphased variant runs.
//
// WebGPU-only for the same reason as ldCompute.slang — see its header.
//! targets: wgsl

import ldUniforms;

struct LDPhasedComputeUniforms {
  uint numSnps;
  uint numWords;
  uint ldMetric;
  uint signedLD;
  // Pair-separation window; see decodeBanded in ldUniforms.
  uint band;
  // Threads per dispatch row — see ldCompute.slang.
  uint dispatchRowStride;
};

[[vk::binding(0, 0)]] StructuredBuffer<uint> haps;
[[vk::binding(1, 0)]] RWStructuredBuffer<float> ldOut;
[[vk::binding(2, 0)]] ConstantBuffer<LDPhasedComputeUniforms> u;

// Layout per SNP: [altH1[0..numWords-1], validH1[0..numWords-1],
//                  altH2[0..numWords-1], validH2[0..numWords-1]]
uint getWord(uint snp, uint arr, uint word) {
  return haps[(snp * 4u + arr) * u.numWords + word];
}

[shader("compute")]
[numthreads(64, 1, 1)]
void computeLDPhased(uint3 gid: SV_DispatchThreadID) {
  uint k;
  uint2 ij;
  if (!bandedCell(gid, u.dispatchRowStride, u.numSnps, u.band, k, ij)) {
    return;
  }
  uint i = ij.x;
  uint j = ij.y;

  uint n11 = 0u;
  uint n10 = 0u;
  uint n01 = 0u;
  uint total = 0u;

  for (uint w = 0u; w < u.numWords; w += 1u) {
    uint ai1 = getWord(i, 0u, w);
    uint vi1 = getWord(i, 1u, w);
    uint aj1 = getWord(j, 0u, w);
    uint vj1 = getWord(j, 1u, w);
    n11 += countbits(ai1 & aj1);
    n10 += countbits(ai1 & ~aj1 & vj1);
    n01 += countbits(vi1 & ~ai1 & aj1);
    total += countbits(vi1 & vj1);

    uint ai2 = getWord(i, 2u, w);
    uint vi2 = getWord(i, 3u, w);
    uint aj2 = getWord(j, 2u, w);
    uint vj2 = getWord(j, 3u, w);
    n11 += countbits(ai2 & aj2);
    n10 += countbits(ai2 & ~aj2 & vj2);
    n01 += countbits(vi2 & ~ai2 & aj2);
    total += countbits(vi2 & vj2);
  }

  float ft = float(total);
  if (!ldEnoughGametes(ft)) {
    ldOut[k] = 0.0;
    return;
  }

  float p01 = float(n01) / ft;
  float p10 = float(n10) / ft;
  float p11 = float(n11) / ft;
  float pA = p10 + p11;
  float pB = p01 + p11;

  if (!ldLociPolymorphic(pA, pB)) {
    ldOut[k] = 0.0;
    return;
  }

  // Shared with calculateLDStatsPhased in @jbrowse/ld-core, this kernel's CPU
  // fallback — see the note in ldCompute.slang.
  float D = p11 - pA * pB;
  float r = ldHaplotypeCorrelation(D, pA, pB);
  ldOut[k] = ldFinalize(r, ldRSquared(r), D, pA, pB, u.ldMetric, u.signedLD);
}
