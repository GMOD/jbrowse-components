// Binary CS encoding for pangenome alignment data.
//
// Format (high 2 bits of first byte = opcode):
//   Match  (00xxxxxx): low 6 bits = length for 1-63, else 0x00 + LEB128 varint
//   Sub    (01xxRRAA): single byte, bits 3:2 = ref base, bits 1:0 = alt base
//   Ins    (10xxxxxx): low 6 bits = length for 1-63, else 0x80 + LEB128 varint,
//                      followed by ceil(len/4) bytes of 2-bit packed bases
//   Del    (11xxxxxx): same as insertion
//
// Base encoding: A=0, C=1, G=2, T=3

const BASE_TO_2BIT: Record<string, number> = {
  a: 0, A: 0,
  c: 1, C: 1,
  g: 2, G: 2,
  t: 3, T: 3,
}

const TWOBIT_TO_BASE = ['a', 'c', 'g', 't']

const OP_MATCH = 0x00
const OP_SUB = 0x40
const OP_INS = 0x80
const OP_DEL = 0xc0
const OP_MASK = 0xc0
const LEN_MASK = 0x3f

// BAM CIGAR op indices (must match parseCigar2 output)
const CIGAR_EQ = 7
const CIGAR_X = 8
const CIGAR_I = 1
const CIGAR_D = 2

function isCsOpChar(ch: string | undefined) {
  return ch === ':' || ch === '*' || ch === '+' || ch === '-'
}

function writeVarint(out: number[], value: number) {
  while (value >= 0x80) {
    out.push((value & 0x7f) | 0x80)
    value >>>= 7
  }
  out.push(value)
}

function readVarint(data: Uint8Array, pos: number) {
  let value = 0
  let shift = 0
  let i = pos
  while (i < data.length) {
    const byte = data[i]!
    value |= (byte & 0x7f) << shift
    i++
    if ((byte & 0x80) === 0) {
      return { value, bytesRead: i - pos }
    }
    shift += 7
  }
  return { value, bytesRead: i - pos }
}

function packBases(seq: string, start: number, len: number) {
  const bytes: number[] = []
  for (let i = 0; i < len; i += 4) {
    let byte = 0
    for (let j = 0; j < 4 && i + j < len; j++) {
      const base = BASE_TO_2BIT[seq[start + i + j]!] ?? 0
      byte |= base << (6 - j * 2)
    }
    bytes.push(byte)
  }
  return bytes
}

function unpackBases(data: Uint8Array, offset: number, len: number) {
  let result = ''
  let byteIdx = offset
  let bitPos = 0
  for (let i = 0; i < len; i++) {
    const byte = data[byteIdx]!
    const base = (byte >>> (6 - bitPos)) & 0x03
    result += TWOBIT_TO_BASE[base]!
    bitPos += 2
    if (bitPos >= 8) {
      bitPos = 0
      byteIdx++
    }
  }
  return result
}

export function encodeBinaryCs(textCs: string) {
  const out: number[] = []
  let i = 0

  while (i < textCs.length) {
    const ch = textCs[i]!
    if (ch === ':') {
      i++
      let num = 0
      while (i < textCs.length && textCs[i]! >= '0' && textCs[i]! <= '9') {
        num = num * 10 + (textCs.charCodeAt(i) - 48)
        i++
      }
      if (num > 0 && num <= 63) {
        out.push(OP_MATCH | num)
      } else if (num > 0) {
        out.push(OP_MATCH)
        writeVarint(out, num)
      }
    } else if (ch === '*') {
      const refBase = BASE_TO_2BIT[textCs[i + 1]!] ?? 0
      const altBase = BASE_TO_2BIT[textCs[i + 2]!] ?? 0
      out.push(OP_SUB | (refBase << 2) | altBase)
      i += 3
    } else if (ch === '+' || ch === '-') {
      const opByte = ch === '+' ? OP_INS : OP_DEL
      i++
      const seqStart = i
      while (i < textCs.length && !isCsOpChar(textCs[i])) {
        i++
      }
      const len = i - seqStart
      if (len > 0) {
        if (len <= 63) {
          out.push(opByte | len)
        } else {
          out.push(opByte)
          writeVarint(out, len)
        }
        const packed = packBases(textCs, seqStart, len)
        for (const b of packed) {
          out.push(b)
        }
      }
    } else {
      i++
    }
  }

  return new Uint8Array(out)
}

export function decodeBinaryCs(data: Uint8Array) {
  let result = ''
  let i = 0

  while (i < data.length) {
    const byte = data[i]!
    const op = byte & OP_MASK

    if (op === OP_MATCH) {
      let len = byte & LEN_MASK
      i++
      if (len === 0) {
        const v = readVarint(data, i)
        len = v.value
        i += v.bytesRead
      }
      if (len > 0) {
        result += `:${len}`
      }
    } else if (op === OP_SUB) {
      const refBase = TWOBIT_TO_BASE[(byte >>> 2) & 0x03]!
      const altBase = TWOBIT_TO_BASE[byte & 0x03]!
      result += `*${refBase}${altBase}`
      i++
    } else if (op === OP_INS || op === OP_DEL) {
      const prefix = op === OP_INS ? '+' : '-'
      let len = byte & LEN_MASK
      i++
      if (len === 0) {
        const v = readVarint(data, i)
        len = v.value
        i += v.bytesRead
      }
      const packedBytes = Math.ceil(len / 4)
      const bases = unpackBases(data, i, len)
      i += packedBytes
      result += `${prefix}${bases}`
    } else {
      i++
    }
  }

  return result
}

export function binaryCsIdentity(data: Uint8Array) {
  let matchBp = 0
  let mismatchBp = 0
  let i = 0

  while (i < data.length) {
    const byte = data[i]!
    const op = byte & OP_MASK

    if (op === OP_MATCH) {
      let len = byte & LEN_MASK
      i++
      if (len === 0) {
        const v = readVarint(data, i)
        len = v.value
        i += v.bytesRead
      }
      matchBp += len
    } else if (op === OP_SUB) {
      mismatchBp++
      i++
    } else if (op === OP_INS || op === OP_DEL) {
      let len = byte & LEN_MASK
      i++
      if (len === 0) {
        const v = readVarint(data, i)
        len = v.value
        i += v.bytesRead
      }
      i += Math.ceil(len / 4)
    } else {
      i++
    }
  }

  const total = matchBp + mismatchBp
  return total > 0 ? matchBp / total : 1
}

// Convert binary CS to packed CIGAR array (same format as parseCigar2:
// each element is (length << 4) | opIndex)
export function binaryCsToCigar(data: Uint8Array) {
  const ret: number[] = []
  let i = 0

  while (i < data.length) {
    const byte = data[i]!
    const op = byte & OP_MASK

    if (op === OP_MATCH) {
      let len = byte & LEN_MASK
      i++
      if (len === 0) {
        const v = readVarint(data, i)
        len = v.value
        i += v.bytesRead
      }
      if (len > 0) {
        ret.push((len << 4) | CIGAR_EQ)
      }
    } else if (op === OP_SUB) {
      ret.push((1 << 4) | CIGAR_X)
      i++
    } else if (op === OP_INS || op === OP_DEL) {
      const cigarOp = op === OP_INS ? CIGAR_I : CIGAR_D
      let len = byte & LEN_MASK
      i++
      if (len === 0) {
        const v = readVarint(data, i)
        len = v.value
        i += v.bytesRead
      }
      i += Math.ceil(len / 4)
      if (len > 0) {
        ret.push((len << 4) | cigarOp)
      }
    } else {
      i++
    }
  }

  return ret
}

export function binaryCsFlip(data: Uint8Array) {
  const out: number[] = []
  let i = 0

  while (i < data.length) {
    const byte = data[i]!
    const op = byte & OP_MASK

    if (op === OP_MATCH) {
      out.push(byte)
      i++
      if ((byte & LEN_MASK) === 0) {
        const v = readVarint(data, i)
        for (let j = 0; j < v.bytesRead; j++) {
          out.push(data[i + j]!)
        }
        i += v.bytesRead
      }
    } else if (op === OP_SUB) {
      // swap ref and alt: (ref << 2 | alt) → (alt << 2 | ref)
      const refBase = (byte >>> 2) & 0x03
      const altBase = byte & 0x03
      out.push(OP_SUB | (altBase << 2) | refBase)
      i++
    } else if (op === OP_INS || op === OP_DEL) {
      // swap ins ↔ del
      const flippedOp = op === OP_INS ? OP_DEL : OP_INS
      let len = byte & LEN_MASK
      out.push(flippedOp | (byte & LEN_MASK))
      i++
      if (len === 0) {
        const v = readVarint(data, i)
        len = v.value
        for (let j = 0; j < v.bytesRead; j++) {
          out.push(data[i + j]!)
        }
        i += v.bytesRead
      }
      const packedBytes = Math.ceil(len / 4)
      for (let j = 0; j < packedBytes; j++) {
        out.push(data[i + j]!)
      }
      i += packedBytes
    } else {
      out.push(byte)
      i++
    }
  }

  return new Uint8Array(out)
}
