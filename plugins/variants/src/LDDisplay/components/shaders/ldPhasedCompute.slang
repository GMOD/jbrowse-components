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
  uint k = gid.y * u.dispatchRowStride + gid.x;
  uint numCells = u.numSnps * (u.numSnps - 1u) / 2u;
  if (k >= numCells) {
    return;
  }

  uint2 ij = decodeTriangular(k);
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

  if (total < 4u) {
    ldOut[k] = 0.0;
    return;
  }

  float ft = float(total);
  float p01 = float(n01) / ft;
  float p10 = float(n10) / ft;
  float p11 = float(n11) / ft;
  float pA = p10 + p11;
  float pB = p01 + p11;
  float qA = 1.0 - pA;
  float qB = 1.0 - pB;

  if (pA <= 0.0 || pA >= 1.0 || pB <= 0.0 || pB >= 1.0) {
    ldOut[k] = 0.0;
    return;
  }

  float D = p11 - pA * pB;
  float denom = pA * qA * pB * qB;
  float r = denom > 0.0 ? D / sqrt(denom) : 0.0;
  float r2 = clamp(r * r, 0.0, 1.0);

  if (u.ldMetric == 0u) {
    ldOut[k] = u.signedLD != 0u ? r : r2;
    return;
  }

  float dprime = 0.0;
  if (D > 0.0) {
    float dmax = min(pA * qB, qA * pB);
    if (dmax > 0.0) {
      dprime = min(1.0, D / dmax);
    }
  } else if (D < 0.0) {
    float absMin = min(pA * pB, qA * qB);
    if (absMin > 0.0) {
      dprime = u.signedLD != 0u ? max(-1.0, D / absMin)
                                : min(1.0, abs(D) / absMin);
    }
  }
  ldOut[k] = dprime;
}
