import type { ActionType } from '../ActionLogger/ActionTypes.ts'

/**
 * Full browser state observation for RL training.
 *
 * Designed for an AI agent that needs to understand:
 * - Where the player is looking (viewport geometry + genomic coordinates)
 * - What data is available (tracks, their types, display configs)
 * - What zoom "semantic level" they're at (can they see bases? genes? chromosomes?)
 * - How they're behaving temporally (speed, action diversity, oscillation)
 * - What content is visible (feature count, variant density, coverage stats)
 */
export interface BrowserState {
  // Viewport geometry
  bpPerPx: number
  offsetPx: number
  viewWidthPx: number

  // Genomic coordinates
  assemblyName: string
  refName: string
  startBp: number
  endBp: number
  viewportBp: number

  // Semantic zoom level (derived from bpPerPx)
  // genome: full chromosome overview (>100 bp/px)
  // region: multi-gene region (10-100 bp/px)
  // gene: individual gene visible (1-10 bp/px)
  // sequence: near base resolution (0.1-1 bp/px)
  // basepair: individual nucleotides visible (<0.1 bp/px)
  zoomLevel: 'genome' | 'region' | 'gene' | 'sequence' | 'basepair'

  // Viewport center in genomic coordinates (useful for distance calculations)
  viewportCenterBp: number

  // Displayed regions (for multi-region / multi-chromosome views)
  displayedRegions: { refName: string; start: number; end: number }[]

  // Track state (detailed)
  activeTracks: TrackInfo[]
  numTracks: number

  // Content visibility (what an agent could "see")
  visibleContentBlocks: number
  hasReferenceSequence: boolean
  hasGeneTrack: boolean
  hasAlignmentTrack: boolean
  hasVariantTrack: boolean
  hasQuantitativeTrack: boolean

  // Labels readable at current zoom? (heuristic: bpPerPx < ~10)
  labelsVisible: boolean

  // Open widgets (feature detail panels, etc.)
  openWidgets: string[]

  // Temporal features
  timeSinceLastAction: number
  actionsInLast5Seconds: number
  sessionDurationMs: number

  // Behavioral features (rolling window)
  actionCountsByType: Record<string, number>
  uniqueRefNamesVisited: string[]
  totalActionsThisSession: number
}

export interface TrackInfo {
  trackId: string
  trackType: string
  displayType?: string
  // Display configuration state (track-level)
  height?: number
  colorScheme?: string
  sortedBy?: string
}

export interface Step {
  timestamp: number
  state: BrowserState
  action: ActionType
  actionMetadata: Record<string, unknown>
  reward: number
  nextState: BrowserState
  terminal: boolean
}

export interface Episode {
  id: string
  startTime: number
  endTime?: number
  steps: Step[]
  outcome: 'completed' | 'abandoned' | 'timeout' | 'in_progress'
  metadata: {
    workerId?: string
    assignmentId?: string
  }
}
