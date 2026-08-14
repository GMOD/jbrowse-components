// The browser half of a review tool, shared by the website's screenshot review
// and (once ported) jbrowse-web's browser-test snapshot review. Both post to the
// same two endpoints under the same two preconditions, and the recovery rules
// are subtle enough that a second copy of them is a second place for them to
// drift — it already had: the same note-loss bug was fixed in both files in one
// commit, twice.
//
// This entry point is REACT, and is only ever reached through esbuild (see
// reviewBundle.ts). It is deliberately not re-exported from the package index,
// which node runs directly with type stripping and which cannot parse JSX.
export { DraftStore, draftHint } from './drafts.ts'
export { errorText, settledAs, shownStatus } from './protocol.ts'
export { useNoteDraft } from './useNoteDraft.ts'
export { useReview } from './useReview.ts'
export { useStickyQueue } from './useStickyQueue.ts'

export type { UseNoteDraftOptions } from './useNoteDraft.ts'
export type { UseReviewOptions } from './useReview.ts'
export type { StickyQueue } from './useStickyQueue.ts'
export type {
  CardMessage,
  PressStatus,
  ReviewEntry,
  WriteResult,
} from './types.ts'
