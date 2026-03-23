# JBrowse Navigator: Game Design Document

## Core Philosophy

Tutorial through play. The player learns JBrowse features organically through level design, not instructions. Like Portal or Breath of the Wild, each level introduces ONE new mechanic and requires its use to progress. Mastery is acknowledged subtly. The game is a funnel from Prolific/MTurk entrants to qualified genome browser users, with ~30x dropout expected.

**Budget-conscious**: No money promises beyond standard participation fee. Intrinsic rewards are mastery acknowledgement, access to future challenges, and the satisfaction of discovery.

---

## Tier Structure

| Tier | Name | Duration | Gate | Expected Survival |
|------|------|----------|------|-------------------|
| 0 | The Hook | 30s | None | 70% |
| 1 | Discovery | 2-3min | Completed Tier 0 | 50% |
| 2 | Competence | 3-5min | Explorer + Eagle Eye + Curator awards | 25% |
| 3 | Expertise | 5-10min | Wayfinder + 80% T2 correct | 10% |
| 4 | Mastery | 3-5min | Biologist award | 4% graduate |

Total: 15-25 min for completers. Median session ~8 min (mid-Tier 2).

---

## Anti-Speedrun Design

The current scavenger hunt is trivially speedrunnable by copy-pasting coordinates. The fix is structural:

1. **Zoom-level tasks**: Require changing bpPerPx, not location. Search bar sets location, not zoom.
2. **Visual identification tasks**: Answer depends on what the player SEES, not where they are.
3. **Action-gated tasks**: Validation requires specific action types (PAN, not SEARCH).
4. **Viewport-relative tasks**: Answer depends on exact scroll position.
5. **No-coordinates tasks**: Landmark descriptions, not coordinates. "Find the gene downstream of EDEN."
6. **Search penalty**: Tasks completed with search bar get halved reward and mark `searchAssisted: true` in export data.

---

## Tier 0: The Hook (30s, 2 tasks)

**T0-1: "Zoom In"**
- Type: `navigate_constrained`
- "Use your scroll wheel on the genome view."
- Validation: bpPerPx decreased by any amount. Cannot be solved via search.
- After 15s, coaching overlay shows mouse scroll gesture.

**T0-2: "Look Around"**
- Type: `navigate_constrained`
- "Click and drag to slide left or right."
- Validation: offsetPx changed by 200+px via PAN action (not SEARCH).

---

## Tier 1: Discovery (2-3min, 5 tasks)

Each task introduces exactly ONE new mechanic.

**T1-1: "What's That?"** (introduces zoom-to-read)
- "Zoom in until you can read individual letters. What's the first letter on the left edge?"
- Answer: A/T/G/C, viewport-dependent validation.
- Awards: Eagle Eye

**T1-2: "Open a Track"** (introduces track selector)
- "Find and open the 'GFF3Tabix genes' track."
- Validation: track in active tracks list.
- Awards: Curator

**T1-3: "Find the Colorful One"** (introduces pan-to-discover)
- "Pan along ctgA with the gene track visible. Find a feature and tell us its name."
- Requires PAN actions, min 3 actions. Search penalty 0.5x.
- Awards: Explorer

**T1-4: "How Many?"** (introduces zoom-out overview)
- "Zoom out until you see multiple features. How many?"
- Multiple choice, visual counting.

**T1-5: "The Other Contig"** (introduces contig switching)
- "Find ctgB."
- Awards: Cartographer

---

## Tier 2: Competence (3-5min, 6 tasks)

Combine controls + biological interpretation. Gate: Explorer + Eagle Eye + Curator.

**T2-1: "Gene Anatomy"** — Count exons in EDEN (zoom + visual)
**T2-2: "Compare by Eye"** — Open microarray track, compare left vs right half of ctgA
**T2-3: "Zoom Level Detective"** — Find zoom threshold where reads appear
**T2-4: Attention check** (bot filter)
**T2-5: "The Downstream Neighbor"** — Pan right from EDEN, read next feature name. Requires PAN_RIGHT.
**T2-6: "Track Layering"** — Interpret strand from gene + alignment tracks

---

## Tier 3: Expertise (5-10min, 5 tasks)

Real bioinformatician workflows. Gate: Wayfinder + 80% T2 correct.

**T3-1: "Coverage Desert"** — Find low-coverage region by visual scanning (long PAN sequences)
**T3-2: "Variant Hunting"** — Open VCF track, classify variant type near position 5000
**T3-3: "Multi-Track Interpretation"** — 3+ tracks, find variant in gene, describe (free text)
**T3-4: "The Other Contig, Revisited"** — Compare ctgA vs ctgB gene density
**T3-5: "Strand Bias"** — Read alignment orientation at specific region

---

## Tier 4: Mastery (3-5min, 3 tasks)

Open-ended exploration. Gate: Biologist award.

**T4-1: "Free Exploration"** — 2min free browsing, 15+ actions, 3+ action types
**T4-2: "Teach a Robot"** — Navigate somewhere interesting, describe step-by-step
**T4-3: "Graduation"** — What would you explore further? Completion code generated.

---

## Award System

| Award | Trigger | RL Signal |
|-------|---------|-----------|
| Explorer | First PAN moving >500bp from start | User can pan |
| Eagle Eye | bpPerPx < 0.1 (base-pair zoom) | User can zoom to detail |
| Curator | First TOGGLE_TRACK | User manages tracks |
| Multi-tasker | 3+ tracks open | Multi-track exploration |
| Wayfinder | Complete navigation with zero SEARCH | Manual navigation |
| Biologist | Free-text answer with 2+ genomics keywords | Biology interpretation |
| Cartographer | Visit both ctgA and ctgB | Multi-contig awareness |

Awards appear as small MUI Chips in widget. Earned via Snackbar notification (4s, auto-dismiss). Missing awards trigger coaching messages, not blocks.

---

## Soft Failure Handling

- Failed task: up to 3 retries, then auto-advance with `autoAdvanced: true` flag
- Timeout: gentle "Let's move on", marked `outcome: 'timeout'`
- No player should ever feel stuck

---

## RL Data Quality Mapping

| Game Mechanic | RL Data | Value |
|---------------|---------|-------|
| Tier 0 zoom | ZOOM sequences with varying magnitude | Zoom granularity |
| Tier 0 pan (search-rejected) | Pure PAN data | Hardest to collect |
| Visual scanning (T1-3) | Extended PAN + pauses | "Look and scan" behavior |
| Zoom-dependent visibility (T2-3) | ZOOM targeting bpPerPx ranges | Info-availability awareness |
| Coverage desert (T3-1) | Signal-guided PAN | Sophisticated navigation |
| Free exploration (T4-1) | Unconstrained expert browsing | Naturalistic data |
| Wayfinder episodes | Zero-SEARCH episodes | Clean manual nav data |

Export flags per episode: `searchUsed`, `autoAdvanced`, `actionDiversity`, `tierAtCompletion`, `awardsEarned`.

---

## Schema Extensions Needed

### TaskConfig additions
```typescript
type: '...' | 'navigate_constrained' | 'action_required'
tier: 0 | 1 | 2 | 3 | 4
requiredAwards?: string[]
navigationConstraints?: {
  requiredActionTypes?: string[]
  forbiddenActionTypes?: { type: string; mode: 'soft' | 'hard' }[]
  zoomRange?: { min?: number; max?: number }
  minActions?: number
}
searchPenalty?: number  // reward multiplier if search used (0-1)
awardOnComplete?: string
coaching?: { message: string; highlightElement?: string }
answerValidation?: { mode: 'exact'|'fuzzy'|'keyword_set'|'viewport_dependent'|'any_nonempty' }
```

### New ActionTypes
HOVER_FEATURE, CLICK_FEATURE, CHANGE_REFNAME, RUBBERBAND_ZOOM, OVERVIEW_CLICK

### New BrowserState fields
zoomLevel ('overview'|'region'|'sequence'), searchBarUsedInEpisode, actionCountByType, uniqueRegionsVisited, currentTier, awardsEarned

---

## New Files Needed

1. `src/ScavengerHunt/AwardManager.ts` — detection, tracking, gating
2. `src/ScavengerHunt/components/AwardChips.tsx` — earned awards display
3. `src/ScavengerHunt/components/AwardSnackbar.tsx` — transient notification
4. `src/ScavengerHunt/components/TierGate.tsx` — coaching when awards missing
5. `src/ScavengerHunt/components/CoachingOverlay.tsx` — Tier 0 highlight overlay
6. `src/ActionLogger/HoverTracker.ts` — optional DOM-level hover tracking

## Implementation Order

1. Schema changes (types, ActionTypes, taskSchema)
2. Model changes (awards, tier 0/4, navigation constraints)
3. TaskValidator extensions (new validation modes)
4. AwardManager (detection, wired to PatchListener)
5. UI components (AwardChips, AwardSnackbar, TierGate)
6. RewardCalculator + StateEncoder extensions
7. CoachingOverlay + HoverTracker (optional)
8. Full volvox task set authoring
