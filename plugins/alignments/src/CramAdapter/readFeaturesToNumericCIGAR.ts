import {
  RF_BASES,
  RF_BASE_QUAL,
  RF_DELETION,
  RF_HARD_CLIP,
  RF_INSERTION,
  RF_INSERT_BASE,
  RF_PADDING,
  RF_POSITIONAL,
  RF_REF_SKIP,
  RF_SOFT_CLIP,
  RF_SUBST,
} from '@gmod/cram'

import type { ReadFeatureArena } from '@gmod/cram'

// CIGAR operation char codes to indices (from BAM spec)
const CIGAR_OP_M = 0
const CIGAR_OP_I = 1
const CIGAR_OP_D = 2
const CIGAR_OP_N = 3
const CIGAR_OP_S = 4
const CIGAR_OP_H = 5
const CIGAR_OP_P = 6

// Above this many ops, hand back a Uint32Array instead of a plain array.
//
// bam-js measured the crossover between the two at ~50-100 ops (see its
// src/record.ts) and CRAM straddles it: a short read produces one op, an ONT
// read thousands. Measured over this repo's fixtures, switching per read halves
// what a long read's memoized NUMERIC_CIGAR retains (1.96MB -> 0.98MB across the
// 37-read ONT slice) at no cost in construction time, while leaving short reads
// on the array path — there a Uint32Array is 2.4x the memory, because ~96 bytes
// of fixed overhead land on a one-element payload, and ~2x slower.
const TYPED_CIGAR_MIN_OPS = 64

// Generates packed NUMERIC_CIGAR format: Uint32Array where each value is (length << 4) | opIndex
//
// Reads cram-js's columnar read features directly. `record.readFeatures`
// rebuilds an array of ~64-byte objects on every access, which is exactly what
// the columnar layout exists to avoid — this walk never needs a feature's
// payload string, only the length cram-js already keeps in `num`. Measured
// against the object walk over this repo's fixtures: 3.7x on a 213k-feature ONT
// slice, 2.8x on 23k short reads.
export function readFeaturesToNumericCIGAR(
  arena: ReadFeatureArena | undefined,
  featureStart: number,
  featureCount: number,
  alignmentStart: number,
  readLen: number,
): ArrayLike<number> {
  const cigarParts: number[] = []
  // One pending (op, len) run. Every emit site below either extends it or
  // flushes it and starts a new one, which is what drops zero-length ops and
  // merges same-op runs: htslib's xx#minimal a1 is 10H, not the 5H5H its two
  // hard-clip features read as, and a2 is 5H10M5H, not 5H0I10M0D5H.
  //
  // Coalescing in these two locals rather than by reading cigarParts[last] back
  // is what keeps it cheap. Through the array — a bounds-checked load plus a
  // write-back on every op — the correctness fixes above cost 29% on the ONT
  // slice and 33% on short reads; in registers, where the array is written once
  // per *run*, they cost 6% and nothing respectively.
  let op = CIGAR_OP_M
  let oplen = 0
  let lastPos = alignmentStart
  let insLen = 0
  let seqLen = 0

  if (arena !== undefined) {
    const { codes, refPos, num } = arena
    const end = featureStart + featureCount
    for (let i = featureStart; i < end; i++) {
      const code = codes[i]!
      // skips q/Q, whose refPos reports where a quality score sits in the read
      // rather than an alignment position — see RF_POSITIONAL in @gmod/cram.
      // Letting one through flushes `insLen` mid-insertion and emits 1I1I where
      // cram-js's getCigarString gives 2I
      if (RF_POSITIONAL[code]) {
        const featureRefPos = refPos[i]!
        const sublen = featureRefPos - lastPos
        seqLen += sublen
        lastPos = featureRefPos

        // Flush pending 'i' insertions unless this feature continues the run —
        // another 'i' with no reference bases in between. Flushing only on a
        // match region (the condition this used to carry) merged the two
        // insertions of htslib's c2#pad s4 across the deletion between them and
        // emitted them after it: 4M1D2I4M, where samtools gives 4M1I1D1I4M
        if (insLen && (sublen || code !== RF_INSERT_BASE)) {
          if (op === CIGAR_OP_I) {
            oplen += insLen
          } else {
            if (oplen) {
              cigarParts.push((oplen << 4) | op)
            }
            op = CIGAR_OP_I
            oplen = insLen
          }
          insLen = 0
        }

        // reference bases between the last feature and this one are matches
        if (sublen) {
          if (op === CIGAR_OP_M) {
            oplen += sublen
          } else {
            if (oplen) {
              cigarParts.push((oplen << 4) | op)
            }
            op = CIGAR_OP_M
            oplen = sublen
          }
        }

        // `num` is the data value for D/N/P/H and the payload length for b/I/S/i,
        // so every branch below reads its length from the same column
        const n = num[i]!

        // ordered by how often each code actually occurs: X is 43% of an ONT
        // slice's features and 73% of a short-read one's, D 32% of ONT, i 16%.
        // Testing 'b' first (which this chain used to) cost X two extra compares
        // on every one of 213k features
        if (code === RF_SUBST || code === RF_BASE_QUAL) {
          // a single substituted or re-qualified base, aligned as a match
          seqLen++
          lastPos++
          if (op === CIGAR_OP_M) {
            oplen++
          } else {
            if (oplen) {
              cigarParts.push((oplen << 4) | op)
            }
            op = CIGAR_OP_M
            oplen = 1
          }
        } else if (code === RF_DELETION || code === RF_REF_SKIP) {
          lastPos += n
          const opIndex = code === RF_DELETION ? CIGAR_OP_D : CIGAR_OP_N
          if (n) {
            if (op === opIndex) {
              oplen += n
            } else {
              if (oplen) {
                cigarParts.push((oplen << 4) | op)
              }
              op = opIndex
              oplen = n
            }
          }
        } else if (code === RF_INSERT_BASE) {
          // 'i' is a single inserted base, so `num` is 1; accumulating rather
          // than emitting is what merges a run of them into one I op
          insLen += n
          seqLen += n
        } else if (code === RF_INSERTION || code === RF_SOFT_CLIP) {
          seqLen += n
          const opIndex = code === RF_INSERTION ? CIGAR_OP_I : CIGAR_OP_S
          if (n) {
            if (op === opIndex) {
              oplen += n
            } else {
              if (oplen) {
                cigarParts.push((oplen << 4) | op)
              }
              op = opIndex
              oplen = n
            }
          }
        } else if (code === RF_BASES) {
          // a verbatim stretch of bases, aligned as matches
          seqLen += n
          lastPos += n
          if (n) {
            if (op === CIGAR_OP_M) {
              oplen += n
            } else {
              if (oplen) {
                cigarParts.push((oplen << 4) | op)
              }
              op = CIGAR_OP_M
              oplen = n
            }
          }
        } else if (code === RF_PADDING || code === RF_HARD_CLIP) {
          const opIndex = code === RF_PADDING ? CIGAR_OP_P : CIGAR_OP_H
          if (n) {
            if (op === opIndex) {
              oplen += n
            } else {
              if (oplen) {
                cigarParts.push((oplen << 4) | op)
              }
              op = opIndex
              oplen = n
            }
          }
        }
      }
    }
  }

  // A trailing insertion sits at its read position, so it precedes the read
  // bases past it — emit it before the trailing matches, not after
  if (insLen) {
    if (op === CIGAR_OP_I) {
      oplen += insLen
    } else {
      if (oplen) {
        cigarParts.push((oplen << 4) | op)
      }
      op = CIGAR_OP_I
      oplen = insLen
    }
  }

  // any read bases past the last feature are trailing matches
  const remaining = readLen - seqLen
  if (remaining > 0) {
    if (op === CIGAR_OP_M) {
      oplen += remaining
    } else {
      if (oplen) {
        cigarParts.push((oplen << 4) | op)
      }
      op = CIGAR_OP_M
      oplen = remaining
    }
  }

  // flush the final run
  if (oplen) {
    cigarParts.push((oplen << 4) | op)
  }

  // converting at the end rather than filling a preallocated Uint32Array keeps
  // one copy of the walk above; the extra linear pass measured free
  return cigarParts.length >= TYPED_CIGAR_MIN_OPS
    ? Uint32Array.from(cigarParts)
    : cigarParts
}
