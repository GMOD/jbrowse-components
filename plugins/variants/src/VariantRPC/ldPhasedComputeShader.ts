export const ldPhasedComputeShader = /* wgsl */ `
struct Uniforms {
  numSnps: u32,
  numWords: u32,
  ldMetric: u32,
  signedLD: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
  _pad3: u32,
}

@group(0) @binding(0) var<storage, read> haps: array<u32>;
@group(0) @binding(1) var<storage, read_write> ldOut: array<f32>;
@group(0) @binding(2) var<uniform> u: Uniforms;

// Layout per SNP: [altH1[0..numWords-1], validH1[0..numWords-1],
//                  altH2[0..numWords-1], validH2[0..numWords-1]]
fn getWord(snp: u32, arr: u32, word: u32) -> u32 {
  return haps[(snp * 4u + arr) * u.numWords + word];
}

@compute @workgroup_size(64)
fn computeLDPhased(@builtin(global_invocation_id) gid: vec3u) {
  let k = gid.x;
  let numCells = u.numSnps * (u.numSnps - 1u) / 2u;
  if (k >= numCells) { return; }

  var i = u32((1.0 + sqrt(1.0 + 8.0 * f32(k))) * 0.5);
  while (i * (i - 1u) / 2u > k) { i -= 1u; }
  while ((i + 1u) * i / 2u <= k) { i += 1u; }
  let j = k - i * (i - 1u) / 2u;

  var n11: u32 = 0u;
  var n10: u32 = 0u;
  var n01: u32 = 0u;
  var total: u32 = 0u;

  for (var w: u32 = 0u; w < u.numWords; w += 1u) {
    let ai1 = getWord(i, 0u, w);
    let vi1 = getWord(i, 1u, w);
    let aj1 = getWord(j, 0u, w);
    let vj1 = getWord(j, 1u, w);
    n11 += countOneBits(ai1 & aj1);
    n10 += countOneBits(ai1 & ~aj1 & vj1);
    n01 += countOneBits(vi1 & ~ai1 & aj1);
    total += countOneBits(vi1 & vj1);

    let ai2 = getWord(i, 2u, w);
    let vi2 = getWord(i, 3u, w);
    let aj2 = getWord(j, 2u, w);
    let vj2 = getWord(j, 3u, w);
    n11 += countOneBits(ai2 & aj2);
    n10 += countOneBits(ai2 & ~aj2 & vj2);
    n01 += countOneBits(vi2 & ~ai2 & aj2);
    total += countOneBits(vi2 & vj2);
  }

  if (total < 4u) { ldOut[k] = 0.0; return; }

  let ft = f32(total);
  let p01 = f32(n01) / ft;
  let p10 = f32(n10) / ft;
  let p11 = f32(n11) / ft;
  let pA = p10 + p11;
  let pB = p01 + p11;
  let qA = 1.0 - pA;
  let qB = 1.0 - pB;

  if (pA <= 0.0 || pA >= 1.0 || pB <= 0.0 || pB >= 1.0) {
    ldOut[k] = 0.0; return;
  }

  let D = p11 - pA * pB;
  let denom = pA * qA * pB * qB;
  let r = select(0.0, D / sqrt(denom), denom > 0.0);
  let r2 = clamp(r * r, 0.0, 1.0);

  if (u.ldMetric == 0u) {
    ldOut[k] = select(r2, r, u.signedLD != 0u);
    return;
  }

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
