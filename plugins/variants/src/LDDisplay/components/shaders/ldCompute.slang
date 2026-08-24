// LD matrix compute — UNPHASED (genotype dosages). One thread per
// lower-triangular cell (i > j); each accumulates the pairwise correlation
// across all samples and writes one r / r2 / D' value.
//
// WebGPU-only: WebGL2 is GLES 3.0 and has no compute stage. The fallback is
// not a GLSL variant of this shader but the CPU path in getLDMatrix.ts, which
// also runs below the MIN_WORK threshold where dispatch overhead dominates.
//! targets: wgsl

import ldUniforms;

struct LDComputeUniforms {
  uint numSnps;
  uint numSamples;
  uint numSamplesPacked;
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

// Genotypes are packed 4 samples per uint as bytes. Missing (-1) is 0xFF.
int getGeno(uint snp, uint sample) {
  uint wordIdx = snp * u.numSamplesPacked + sample / 4u;
  uint byteShift = (sample & 3u) * 8u;
  uint b = (genotypes[wordIdx] >> byteShift) & 0xFFu;
  return b == 0xFFu ? -1 : int(b);
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

  float count = 0.0;
  float s1 = 0.0;
  float s2 = 0.0;
  float s1sq = 0.0;
  float s2sq = 0.0;
  float sprod = 0.0;

  for (uint s = 0u; s < u.numSamples; s += 1u) {
    int g1 = getGeno(i, s);
    int g2 = getGeno(j, s);
    if (g1 >= 0 && g2 >= 0) {
      float f1 = float(g1);
      float f2 = float(g2);
      count += 1.0;
      s1 += f1;
      s2 += f2;
      s1sq += f1 * f1;
      s2sq += f2 * f2;
      sprod += f1 * f2;
    }
  }

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
