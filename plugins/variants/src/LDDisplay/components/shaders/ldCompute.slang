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
  // Threads per dispatch row (workgroupsX * WORKGROUP_SIZE_X). Cells are
  // addressed as a 2D grid: a 1D dispatch caps at
  // maxComputeWorkgroupsPerDimension (65535) workgroups = ~4.19M cells, which
  // a mere ~2896 SNPs exceeds.
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
  uint k = gid.y * u.dispatchRowStride + gid.x;
  uint numCells = u.numSnps * (u.numSnps - 1u) / 2u;
  if (k >= numCells) {
    return;
  }

  uint2 ij = decodeTriangular(k);
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

  if (count < 2.0) {
    ldOut[k] = 0.0;
    return;
  }

  float pA = s1 / (2.0 * count);
  float pB = s2 / (2.0 * count);
  if (pA <= 0.0 || pA >= 1.0 || pB <= 0.0 || pB >= 1.0) {
    ldOut[k] = 0.0;
    return;
  }

  float mean1 = s1 / count;
  float mean2 = s2 / count;
  float var1 = s1sq / count - mean1 * mean1;
  float var2 = s2sq / count - mean2 * mean2;
  float cov = sprod / count - mean1 * mean2;
  float r = 0.0;
  float r2 = 0.0;
  if (var1 > 0.0 && var2 > 0.0) {
    r = cov / sqrt(var1 * var2);
    r2 = clamp(r * r, 0.0, 1.0);
  }

  // Composite LD estimator (Weir 1979), D = Cov(g1,g2) / 2.
  float D = cov * 0.5;
  ldOut[k] = ldFinalize(r, r2, D, pA, pB, u.ldMetric, u.signedLD);
}
