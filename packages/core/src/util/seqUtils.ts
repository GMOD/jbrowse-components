// from bioperl: tr/acgtrymkswhbvdnxACGTRYMKSWHBVDNX/tgcayrkmswdvbhnxTGCAYRKMSWDVBHNX/
// generated with:
// perl -MJSON -E '@l = split "","acgtrymkswhbvdnxACGTRYMKSWHBVDNX"; print to_json({ map { my $in = $_; tr/acgtrymkswhbvdnxACGTRYMKSWHBVDNX/tgcayrkmswdvbhnxTGCAYRKMSWDVBHNX/; $in => $_ } @l})'
export const complementTable: Record<string, string> = {
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
}

const ASCII_CODES = 128
const ASCII_MASK = ASCII_CODES - 1

function codeTable(pairs: Record<string, string>) {
  const table = new Uint8Array(ASCII_CODES)
  for (let i = 0; i < ASCII_CODES; i++) {
    table[i] = i
  }
  for (const [from, to] of Object.entries(pairs)) {
    table[from.charCodeAt(0)] = to.charCodeAt(0)
  }
  return table
}

const COMPLEMENT_CODES = codeTable(complementTable)
const SAME_CODES = codeTable({})

// Below this length string concatenation beats allocating a byte buffer
const SHORT_STRING = 256

const latin1 = new TextDecoder('latin1')

// Sequences are ASCII; a wider character comes out masked to 7 bits
function mapCodes(str: string, table: Uint8Array, reversed: boolean) {
  const n = str.length
  const first = reversed ? n - 1 : 0
  const step = reversed ? -1 : 1
  let out = ''
  if (n < SHORT_STRING) {
    for (let i = 0; i < n; i++) {
      out += String.fromCharCode(
        table[str.charCodeAt(first + step * i) & ASCII_MASK]!,
      )
    }
  } else {
    const buf = new Uint8Array(n)
    for (let i = 0; i < n; i++) {
      buf[i] = table[str.charCodeAt(first + step * i) & ASCII_MASK]!
    }
    out = latin1.decode(buf)
  }
  return out
}

export function revcom(str: string) {
  return mapCodes(str, COMPLEMENT_CODES, true)
}

export function reverse(str: string) {
  return mapCodes(str, SAME_CODES, true)
}

export function complement(str: string) {
  return mapCodes(str, COMPLEMENT_CODES, false)
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
