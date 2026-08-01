// from bioperl: tr/acgtrymkswhbvdnxACGTRYMKSWHBVDNX/tgcayrkmswdvbhnxTGCAYRKMSWDVBHNX/
// generated with:
// perl -MJSON -E '@l = split "","acgtrymkswhbvdnxACGTRYMKSWHBVDNX"; print to_json({ map { my $in = $_; tr/acgtrymkswhbvdnxACGTRYMKSWHBVDNX/tgcayrkmswdvbhnxTGCAYRKMSWDVBHNX/; $in => $_ } @l})'
export const complementTable = {
  S: 'S',
  w: 'w',
  T: 'A',
  r: 'y',
  a: 't',
  N: 'N',
  K: 'M',
  x: 'x',
  d: 'h',
  Y: 'R',
  V: 'B',
  y: 'r',
  M: 'K',
  h: 'd',
  k: 'm',
  C: 'G',
  g: 'c',
  t: 'a',
  A: 'T',
  n: 'n',
  W: 'W',
  X: 'X',
  m: 'k',
  v: 'b',
  B: 'V',
  s: 's',
  H: 'D',
  c: 'g',
  D: 'H',
  b: 'v',
  R: 'Y',
  G: 'C',
} as Record<string, string>

export function revcom(str: string) {
  const n = str.length
  const arr = new Array<string>(n)
  for (let i = 0; i < n; i++) {
    const c = str[n - 1 - i]!
    arr[i] = complementTable[c] ?? c
  }
  return arr.join('')
}

export function reverse(str: string) {
  // index loop rather than [...str] spread: sequences can be large and the
  // spread's code-point iterator is markedly slower than raw UTF-16 access
  const n = str.length
  const arr = new Array<string>(n)
  for (let i = 0; i < n; i++) {
    arr[i] = str[n - 1 - i]!
  }
  return arr.join('')
}

export function complement(str: string) {
  const n = str.length
  const arr = new Array<string>(n)
  for (let i = 0; i < n; i++) {
    const c = str[i]!
    arr[i] = complementTable[c] ?? c
  }
  return arr.join('')
}

export type Frame = 1 | 2 | 3 | -1 | -2 | -3

export function getFrame(
  start: number,
  end: number,
  strand: 1 | -1,
  phase: 0 | 1 | 2,
): Frame {
  return strand === 1
    ? ((((start + phase) % 3) + 1) as 1 | 2 | 3)
    : ((-1 * ((end - phase) % 3) - 1) as -1 | -2 | -3)
}

/**
 * The start codon the sequence track highlights. Deliberately NOT
 * `getGeneticCode(1).starts`, which is `['TTG','CTG','ATG']` — NCBI marks the
 * alternative initiators, but highlighting every TTG and CTG in a reference
 * sequence would be noise. This is a display convention, not the genetic code.
 */
export const defaultStarts = ['ATG']

export function stitch(
  subfeats: { start: number; end: number }[],
  sequence: string,
) {
  return subfeats.map(sub => sequence.slice(sub.start, sub.end)).join('')
}
