// Sample-by-sample Euclidean distance matrix for clustering: one thread per
// pair (i, j) with j > i, looping over the columns of both rows. Writes the
// upper triangle of an n x n row-major matrix, which is the half
// @gmod/hclust's `clusterData({ distances })` reads.
//
// The column range may arrive in slabs when the rows do not fit one storage
// buffer: each dispatch adds its slab's sum of squares to the cell, and the
// last one takes the square root.
//
// Squares are summed in blocks of 16 and each block is added to the running
// total with Kahan compensation. A plain f32 sum drifts with the column count
// on fractional input (site-mean imputed dosages, identity fractions): 3.6e-5
// relative at 20,000 columns where the wasm's f64 accumulator holds a few
// ulps. Integer dosages sum exactly either way.
//
// WebGPU-only; WebGL2 has no compute stage. The fallback is hclust's own wasm
// build in clusterMatrix.ts, which also runs below the work gate.
//! targets: wgsl

struct SampleDistanceUniforms {
  uint n;
  // Columns in this slab.
  uint v;
  // 1 when an earlier slab already wrote partial sums into `dist`.
  uint accumulate;
  // 1 on the last slab: the cell becomes sqrt(sum).
  uint finalize;
};

[[vk::binding(0, 0)]] StructuredBuffer<float> data;
[[vk::binding(1, 0)]] RWStructuredBuffer<float> dist;
[[vk::binding(2, 0)]] ConstantBuffer<SampleDistanceUniforms> u;

[shader("compute")]
[numthreads(16, 16, 1)]
void sampleDistance(uint3 gid: SV_DispatchThreadID) {
  uint i = gid.y;
  uint j = gid.x;
  if (i >= u.n || j >= u.n || j <= i) {
    return;
  }
  uint a = i * u.v;
  uint b = j * u.v;
  float sum = 0.0;
  float comp = 0.0;
  uint k = 0u;
  for (; k + 16u <= u.v; k += 16u) {
    float block = 0.0;
    for (uint t = 0u; t < 16u; t += 1u) {
      float d = data[a + k + t] - data[b + k + t];
      block += d * d;
    }
    float y = block - comp;
    float next = sum + y;
    comp = (next - sum) - y;
    sum = next;
  }
  float tail = 0.0;
  for (; k < u.v; k += 1u) {
    float d = data[a + k] - data[b + k];
    tail += d * d;
  }
  sum += tail - comp;

  uint o = i * u.n + j;
  float total = u.accumulate == 1u ? dist[o] + sum : sum;
  dist[o] = u.finalize == 1u ? sqrt(total) : total;
}
