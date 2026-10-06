import type { CandidateVariant, ReviewDecision } from '../candidates/types.ts'

/**
 * What a command may touch: view review actions, nothing else. Keys, widget
 * buttons and menus all go through `execute`, and no command reads a
 * `KeyboardEvent`.
 */
export interface ReviewCommandTarget {
  reviewActive: boolean
  currentCandidate: CandidateVariant | undefined
  candidateCount: number
  nextCandidate(): void
  previousCandidate(): void
  nextUnreviewed(): void
  restoreReviewViewport(): void
  sortTargetsAtCandidate(): void
  setDecision(decision: ReviewDecision): void
  clearDecision(): void
  showCandidateDetails(): void
}

export const REVIEW_COMMAND_IDS = [
  'next',
  'previous',
  'nextUnreviewed',
  'restoreViewport',
  'sort',
  'accept',
  'reject',
  'flag',
  'clearDecision',
  'details',
] as const

export type ReviewCommandId = (typeof REVIEW_COMMAND_IDS)[number]

export interface ReviewCommand {
  id: ReviewCommandId
  label: string
  // whether a held key may fire it again: navigation yes, a decision no, so a
  // key held a beat too long does not decide the next candidate too
  repeatable: boolean
  enabled(view: ReviewCommandTarget): boolean
  execute(view: ReviewCommandTarget): void
}

const hasList = (v: ReviewCommandTarget) =>
  v.reviewActive && v.candidateCount > 0
const hasCurrent = (v: ReviewCommandTarget) =>
  v.reviewActive && v.currentCandidate !== undefined

export const REVIEW_COMMANDS: readonly ReviewCommand[] = [
  {
    id: 'next',
    label: 'Next candidate',
    repeatable: true,
    enabled: hasList,
    execute: v => {
      v.nextCandidate()
    },
  },
  {
    id: 'previous',
    label: 'Previous candidate',
    repeatable: true,
    enabled: hasList,
    execute: v => {
      v.previousCandidate()
    },
  },
  {
    id: 'nextUnreviewed',
    label: 'Next unreviewed',
    repeatable: true,
    enabled: hasList,
    execute: v => {
      v.nextUnreviewed()
    },
  },
  {
    id: 'restoreViewport',
    label: 'Re-centre on candidate',
    repeatable: false,
    enabled: hasCurrent,
    execute: v => {
      v.restoreReviewViewport()
    },
  },
  {
    id: 'sort',
    label: 'Re-sort at candidate',
    repeatable: false,
    enabled: hasCurrent,
    execute: v => {
      v.sortTargetsAtCandidate()
    },
  },
  {
    id: 'accept',
    label: 'Accept',
    repeatable: false,
    enabled: hasCurrent,
    execute: v => {
      v.setDecision('accepted')
    },
  },
  {
    id: 'reject',
    label: 'Reject',
    repeatable: false,
    enabled: hasCurrent,
    execute: v => {
      v.setDecision('rejected')
    },
  },
  {
    id: 'flag',
    label: 'Flag',
    repeatable: false,
    enabled: hasCurrent,
    execute: v => {
      v.setDecision('flagged')
    },
  },
  {
    id: 'clearDecision',
    label: 'Unmark',
    repeatable: false,
    enabled: hasCurrent,
    execute: v => {
      v.clearDecision()
    },
  },
  {
    id: 'details',
    label: 'Show details',
    repeatable: false,
    enabled: hasCurrent,
    execute: v => {
      v.showCandidateDetails()
    },
  },
]

const BY_ID = new Map(REVIEW_COMMANDS.map(c => [c.id, c]))

export function getReviewCommand(id: ReviewCommandId) {
  return BY_ID.get(id)!
}

/** Run a command if it is enabled; whether it ran. */
export function runReviewCommand(
  id: ReviewCommandId,
  view: ReviewCommandTarget,
) {
  const command = getReviewCommand(id)
  if (command.enabled(view)) {
    command.execute(view)
    return true
  }
  return false
}
