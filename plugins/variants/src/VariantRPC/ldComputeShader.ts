export const ldComputeShader = /* wgsl */ `
struct Uniforms {
  numSnps: u32,
  numSamples: u32,
  numSamplesPacked: u32,
  ldMetric: u32,
  signedLD: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
}

@group(0) @binding(0) var<storage, read> genotypes: array<u32>;
@group(0) @binding(1) var<storage, read_write> ldOut: array<f32>;
@group(0) @binding(2) var<uniform> u: Uniforms;

// Genotypes are packed 4 per u32 as u8.
// Missing (-1) is stored as 0xFF.
fn getGeno(snp: u32, sample: u32) -> i32 {
  let wordIdx = snp * u.numSamplesPacked + sample / 4u;
  let byteShift = (sample & 3u) * 8u;
  let byte = (genotypes[wordIdx] >> byteShift) & 0xFFu;
  return select(i32(byte), -1, byte == 0xFFu);
}

@compute @workgroup_size(64)
fn computeLD(@builtin(global_invocation_id) gid: vec3u) {
  let k = gid.x;
  let numCells = u.numSnps * (u.numSnps - 1u) / 2u;
  if (k >= numCells) { return; }

  // Map flat lower-triangular index k to (i, j) with i > j.
  // k = i*(i-1)/2 + j  =>  i = floor((1 + sqrt(1 + 8k)) / 2)
  var i = u32((1.0 + sqrt(1.0 + 8.0 * f32(k))) * 0.5);
  while (i * (i - 1u) / 2u > k) { i -= 1u; }
  while ((i + 1u) * i / 2u <= k) { i += 1u; }
  let j = k - i * (i - 1u) / 2u;

  var count: f32 = 0.0;
  var s1: f32 = 0.0;
  var s2: f32 = 0.0;
  var s1sq: f32 = 0.0;
  var s2sq: f32 = 0.0;
  var sprod: f32 = 0.0;

  for (var s: u32 = 0u; s < u.numSamples; s += 1u) {
    let g1 = getGeno(i, s);
    let g2 = getGeno(j, s);
    if (g1 >= 0 && g2 >= 0) {
      let f1 = f32(g1);
      let f2 = f32(g2);
      count += 1.0;
      s1 += f1;
      s2 += f2;
      s1sq += f1 * f1;
      s2sq += f2 * f2;
      sprod += f1 * f2;
    }
  }

  if (count < 2.0) { ldOut[k] = 0.0; return; }

  let pA = s1 / (2.0 * count);
  let pB = s2 / (2.0 * count);
  if (pA <= 0.0 || pA >= 1.0 || pB <= 0.0 || pB >= 1.0) {
    ldOut[k] = 0.0; return;
  }

  let mean1 = s1 / count;
  let mean2 = s2 / count;
  let var1 = s1sq / count - mean1 * mean1;
  let var2 = s2sq / count - mean2 * mean2;
  var r: f32 = 0.0;
  var r2: f32 = 0.0;
  if (var1 > 0.0 && var2 > 0.0) {
    let cov = sprod / count - mean1 * mean2;
    r = cov / sqrt(var1 * var2);
    r2 = clamp(r * r, 0.0, 1.0);
  }

  if (u.ldMetric == 0u) {
    ldOut[k] = select(r2, r, u.signedLD != 0u);
    return;
  }

  // D' calculation: composite LD estimator (Weir 1979), D = Cov(g1,g2) / 2
  let D = (sprod / count - mean1 * mean2) * 0.5;
  let qA = 1.0 - pA;
  let qB = 1.0 - pB;
  var dprime: f32 = 0.0;
  if (D > 0.0) {
    let dmax = min(pA * qB, qA * pB);
    if (dmax > 0.0) { dprime = min(1.0, D / dmax); }
  } else if (D < 0.0) {
    let absMin = min(pA * pB, qA * qB);
    if (absMin > 0.0) {
      dprime = select(
        min(1.0, abs(D) / absMin),
        max(-1.0, D / absMin),
        u.signedLD != 0u,
      );
    }
  }

  ldOut[k] = dprime;
}
`
