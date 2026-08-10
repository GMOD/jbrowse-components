import type { Verdict } from '../reviewVerdicts.ts'

// The half of a review entry the write protocol needs. Each tool's /api payload
// is this plus whatever its own cards happen to draw, so the protocol and the
// hooks below are generic in `E extends ReviewEntry`.
export interface ReviewEntry {
  name: string
  verdict?: Verdict
  // The verdict no longer describes the image on disk. Server-computed, because
  // only the server has both the stored hash and the bytes to hash.
  stale: boolean
  // sha1 of the image as this page is showing it, or null when there is none on
  // disk. It rides on every write as a precondition, which is what makes an
  // approval mean "I looked at these pixels" rather than "I clicked while these
  // pixels happened to be the current ones".
  imageHash: string | null
}

// A write that failed, or one the server refused because the entry moved on
// disk. Absent for the overwhelmingly common case where it just worked.
export interface CardMessage {
  text: string
  kind: 'warn' | 'error'
}

// A verdict status word, or null for a clear. Never undefined: `pressed` uses
// absence to mean "nothing in flight", so a clear needs a value of its own.
export type PressStatus = Verdict['status'] | null

// What the server said, in the two shapes a caller has to tell apart. A 409 is
// recoverable by adopting `current`; anything else throws.
export type WriteResult =
  | { conflict: false; body: Verdict | undefined }
  | {
      conflict: true
      reason: 'verdict' | 'image'
      current: Verdict | undefined
      stale: boolean
      imageHash: string | null
    }
