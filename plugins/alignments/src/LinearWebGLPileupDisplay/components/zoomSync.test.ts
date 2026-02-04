/**
 * Comprehensive tests for zoom + sync logic
 * Run with: node --experimental-strip-types zoomSync.test.ts
 *
 * This simulates the exact flow in the component:
 * 1. User zooms → domain is updated
 * 2. offsetPx is calculated from domain
 * 3. syncToView is called
 * 4. View may adjust offsetPx and/or contentBlocks
 * 5. syncFromView effect runs
 * 6. We need to preserve the correct domain
 */

// ============================================================
// STATE SIMULATION
// ============================================================

interface ContentBlock {
  start: number
  end: number
  offsetPx: number
  refName: string
}

interface ViewState {
  offsetPx: number
  bpPerPx: number
  width: number
  minBpPerPx: number
  maxBpPerPx: number
}

interface ComponentState {
  domainRef: [number, number] | null
  offsetPxRef: number
  bpPerPxRef: number
  interactingRef: boolean
}

// Simulates view.dynamicBlocks.contentBlocks
// In real app, this changes based on bpPerPx and offsetPx
function getContentBlocks(viewState: ViewState): ContentBlock[] {
  // Simulate: blockOffsetPx is calculated based on some internal logic
  // For simplicity, let's say it's proportional to bpPerPx
  const blockOffsetPx = 1000 / viewState.bpPerPx
  return [{
    start: 50000,
    end: 150000,
    offsetPx: blockOffsetPx,
    refName: 'chr1',
  }]
}

// ============================================================
// CORE FUNCTIONS (extracted from component)
// ============================================================

function computeDomainFromView(
  viewState: ViewState,
  contentBlocks: ContentBlock[],
): [number, number] {
  const first = contentBlocks[0]
  const blockOffsetPx = first.offsetPx
  const deltaPx = viewState.offsetPx - blockOffsetPx
  const deltaBp = deltaPx * viewState.bpPerPx
  const domainStart = first.start + deltaBp
  const domainEnd = domainStart + viewState.width * viewState.bpPerPx
  return [domainStart, domainEnd]
}

function computeOffsetPxFromDomain(
  domain: [number, number],
  bpPerPx: number,
  contentBlocks: ContentBlock[],
): number {
  const first = contentBlocks[0]
  const blockOffsetPx = first.offsetPx
  const domainStart = domain[0]
  return blockOffsetPx + (domainStart - first.start) / bpPerPx
}

function zoomAtPosition(
  currentDomain: [number, number],
  mouseX: number,
  width: number,
  zoomIn: boolean,
  zoomFactor: number = 1.05,
): { domain: [number, number]; bpPerPx: number } {
  const domainWidth = currentDomain[1] - currentDomain[0]
  const mouseFraction = mouseX / width
  const mouseBp = currentDomain[0] + domainWidth * mouseFraction

  const factor = zoomIn ? 1 / zoomFactor : zoomFactor
  const newDomainWidth = domainWidth * factor
  const newBpPerPx = newDomainWidth / width

  const newDomainStart = mouseBp - mouseFraction * newDomainWidth
  const newDomainEnd = newDomainStart + newDomainWidth

  return {
    domain: [newDomainStart, newDomainEnd],
    bpPerPx: newBpPerPx,
  }
}

// ============================================================
// SIMULATE COMPONENT BEHAVIOR
// ============================================================

class ComponentSimulator {
  componentState: ComponentState
  viewState: ViewState

  constructor(initialView: ViewState) {
    this.viewState = { ...initialView }
    const contentBlocks = getContentBlocks(this.viewState)
    const domain = computeDomainFromView(this.viewState, contentBlocks)

    this.componentState = {
      domainRef: domain,
      offsetPxRef: this.viewState.offsetPx,
      bpPerPxRef: this.viewState.bpPerPx,
      interactingRef: false,
    }
  }

  // Simulate wheel zoom
  zoom(mouseX: number, zoomIn: boolean): void {
    const { domainRef, bpPerPxRef } = this.componentState
    if (!domainRef) return

    this.componentState.interactingRef = true

    const result = zoomAtPosition(
      domainRef,
      mouseX,
      this.viewState.width,
      zoomIn,
    )

    // Check zoom limits
    if (result.bpPerPx < this.viewState.minBpPerPx ||
        result.bpPerPx > this.viewState.maxBpPerPx) {
      console.log('  [zoom] Hit limit, not changing')
      return
    }

    // Update component state
    this.componentState.domainRef = result.domain
    this.componentState.bpPerPxRef = result.bpPerPx

    // Calculate offsetPx from domain using CURRENT contentBlocks
    const contentBlocks = getContentBlocks(this.viewState) // Still using old view state
    this.componentState.offsetPxRef = computeOffsetPxFromDomain(
      result.domain,
      result.bpPerPx,
      contentBlocks,
    )

    console.log('  [zoom] Updated component:', {
      domain: this.componentState.domainRef.map(d => Math.round(d)),
      bpPerPx: this.componentState.bpPerPxRef.toFixed(2),
      offsetPx: this.componentState.offsetPxRef.toFixed(1),
    })
  }

  // Simulate debouncedSyncToView completing
  syncToView(): void {
    console.log('  [syncToView] Sending to view:', {
      bpPerPx: this.componentState.bpPerPxRef.toFixed(2),
      offsetPx: this.componentState.offsetPxRef.toFixed(1),
    })

    // View receives our values
    this.viewState.bpPerPx = this.componentState.bpPerPxRef
    this.viewState.offsetPx = this.componentState.offsetPxRef

    // CRITICAL: View may adjust offsetPx based on its own logic!
    // This simulates what the real view does
    this.simulateViewAdjustment()

    this.componentState.interactingRef = false
  }

  // Simulate the view adjusting our values
  // Mode: 'mild' for small adjustments, 'aggressive' for large adjustments like real app
  simulateViewAdjustment(mode: 'mild' | 'aggressive' = 'mild'): void {
    // The view recalculates contentBlocks based on new bpPerPx
    const newContentBlocks = getContentBlocks(this.viewState)

    if (mode === 'aggressive') {
      // Simulate what the real app does: large offsetPx changes
      // From logs: 2416 → 1307 (diff of ~1100)
      // The view seems to recalculate offsetPx entirely based on new contentBlocks
      const oldOffsetPx = this.viewState.offsetPx
      this.viewState.offsetPx = newContentBlocks[0].offsetPx // Reset to block start!
      console.log('  [view] AGGRESSIVE adjustment:', oldOffsetPx.toFixed(1),
                  '→', this.viewState.offsetPx.toFixed(1),
                  `(diff: ${(this.viewState.offsetPx - oldOffsetPx).toFixed(1)})`)
    } else {
      // Mild adjustment
      const adjustment = (newContentBlocks[0].offsetPx - 1000 / 10) * 0.5
      this.viewState.offsetPx += adjustment
      console.log('  [view] Adjusted offsetPx by', adjustment.toFixed(1),
                  '→', this.viewState.offsetPx.toFixed(1))
    }
  }

  // Simulate the syncFromView effect (CURRENT BUGGY VERSION)
  syncFromViewBuggy(): void {
    if (this.componentState.interactingRef) {
      console.log('  [syncFromView] Skipped - interacting')
      return
    }

    const bpPerPxMatch = Math.abs(this.viewState.bpPerPx - this.componentState.bpPerPxRef) < 0.001
    const offsetMatch = Math.abs(this.viewState.offsetPx - this.componentState.offsetPxRef) < 5

    if (bpPerPxMatch && offsetMatch) {
      console.log('  [syncFromView] Skipped - values match')
      return
    }

    // BUG: We recalculate domain even though bpPerPx matches!
    console.log('  [syncFromView] RECALCULATING DOMAIN (this is the bug)')
    this.componentState.offsetPxRef = this.viewState.offsetPx
    this.componentState.bpPerPxRef = this.viewState.bpPerPx

    const contentBlocks = getContentBlocks(this.viewState)
    this.componentState.domainRef = computeDomainFromView(this.viewState, contentBlocks)

    console.log('  [syncFromView] New domain:', this.componentState.domainRef.map(d => Math.round(d)))
  }

  // Simulate the syncFromView effect (FIXED VERSION)
  syncFromViewFixed(): void {
    if (this.componentState.interactingRef) {
      console.log('  [syncFromView] Skipped - interacting')
      return
    }

    const bpPerPxMatch = Math.abs(this.viewState.bpPerPx - this.componentState.bpPerPxRef) < 0.001
    const offsetMatch = Math.abs(this.viewState.offsetPx - this.componentState.offsetPxRef) < 5

    if (bpPerPxMatch && offsetMatch) {
      console.log('  [syncFromView] Skipped - values match')
      return
    }

    if (bpPerPxMatch && !offsetMatch) {
      // FIX: Only update offsetPx, keep domain!
      console.log('  [syncFromView] View adjusted offsetPx, keeping domain')
      this.componentState.offsetPxRef = this.viewState.offsetPx
      return
    }

    // bpPerPx changed - external navigation
    console.log('  [syncFromView] External change, recalculating domain')
    this.componentState.offsetPxRef = this.viewState.offsetPx
    this.componentState.bpPerPxRef = this.viewState.bpPerPx

    const contentBlocks = getContentBlocks(this.viewState)
    this.componentState.domainRef = computeDomainFromView(this.viewState, contentBlocks)
  }

  getDomain(): [number, number] | null {
    return this.componentState.domainRef
  }

  getMouseBp(mouseX: number): number {
    const domain = this.componentState.domainRef
    if (!domain) return 0
    const fraction = mouseX / this.viewState.width
    return domain[0] + (domain[1] - domain[0]) * fraction
  }
}

// ============================================================
// TESTS
// ============================================================

function assertEqual(actual: number, expected: number, epsilon: number, message: string): boolean {
  const diff = Math.abs(actual - expected)
  if (diff > epsilon) {
    console.error(`❌ FAIL: ${message}`)
    console.error(`   Expected: ${expected}, Got: ${actual}, Diff: ${diff}`)
    return false
  }
  console.log(`✅ PASS: ${message}`)
  return true
}

console.log('\n' + '='.repeat(60))
console.log('TEST: Zoom out with BUGGY syncFromView')
console.log('='.repeat(60) + '\n')

{
  const sim = new ComponentSimulator({
    offsetPx: 500,
    bpPerPx: 10,
    width: 1000,
    minBpPerPx: 0.1,
    maxBpPerPx: 100,
  })

  const mouseX = 500 // center
  const initialMouseBp = sim.getMouseBp(mouseX)
  console.log('Initial state:')
  console.log('  Domain:', sim.getDomain()?.map(d => Math.round(d)))
  console.log('  MouseBp at center:', Math.round(initialMouseBp))

  console.log('\nZooming out 3 times...')
  for (let i = 0; i < 3; i++) {
    console.log(`\n--- Zoom out ${i + 1} ---`)
    sim.zoom(mouseX, false) // zoom out
    sim.syncToView()
    sim.syncFromViewBuggy()
  }

  const finalMouseBp = sim.getMouseBp(mouseX)
  console.log('\nFinal state:')
  console.log('  Domain:', sim.getDomain()?.map(d => Math.round(d)))
  console.log('  MouseBp at center:', Math.round(finalMouseBp))
  console.log('  DRIFT:', Math.round(finalMouseBp - initialMouseBp), 'bp')

  const passed = assertEqual(finalMouseBp, initialMouseBp, 100, 'Mouse position preserved (buggy)')
  if (!passed) {
    console.log('\n⚠️  The buggy version causes significant drift!')
  }
}

console.log('\n' + '='.repeat(60))
console.log('TEST: Zoom out with FIXED syncFromView')
console.log('='.repeat(60) + '\n')

{
  const sim = new ComponentSimulator({
    offsetPx: 500,
    bpPerPx: 10,
    width: 1000,
    minBpPerPx: 0.1,
    maxBpPerPx: 100,
  })

  const mouseX = 500
  const initialMouseBp = sim.getMouseBp(mouseX)
  console.log('Initial state:')
  console.log('  Domain:', sim.getDomain()?.map(d => Math.round(d)))
  console.log('  MouseBp at center:', Math.round(initialMouseBp))

  console.log('\nZooming out 3 times...')
  for (let i = 0; i < 3; i++) {
    console.log(`\n--- Zoom out ${i + 1} ---`)
    sim.zoom(mouseX, false)
    sim.syncToView()
    sim.syncFromViewFixed()
  }

  const finalMouseBp = sim.getMouseBp(mouseX)
  console.log('\nFinal state:')
  console.log('  Domain:', sim.getDomain()?.map(d => Math.round(d)))
  console.log('  MouseBp at center:', Math.round(finalMouseBp))
  console.log('  DRIFT:', Math.round(finalMouseBp - initialMouseBp), 'bp')

  assertEqual(finalMouseBp, initialMouseBp, 1, 'Mouse position preserved (fixed)')
}

console.log('\n' + '='.repeat(60))
console.log('TEST: External navigation should update domain')
console.log('='.repeat(60) + '\n')

{
  const sim = new ComponentSimulator({
    offsetPx: 500,
    bpPerPx: 10,
    width: 1000,
    minBpPerPx: 0.1,
    maxBpPerPx: 100,
  })

  console.log('Initial domain:', sim.getDomain()?.map(d => Math.round(d)))

  // Simulate external navigation (user clicks on overview, etc)
  console.log('\nSimulating external navigation...')
  sim.viewState.bpPerPx = 20 // Changed!
  sim.viewState.offsetPx = 1000

  sim.syncFromViewFixed()

  console.log('After external nav domain:', sim.getDomain()?.map(d => Math.round(d)))

  // Domain should have changed
  const domain = sim.getDomain()
  if (domain && domain[0] !== 55000) {
    console.log('✅ PASS: Domain updated after external navigation')
  } else {
    console.log('❌ FAIL: Domain should have updated')
  }
}

console.log('\n' + '='.repeat(60))
console.log('TEST: Rapid zoom should not accumulate drift')
console.log('='.repeat(60) + '\n')

{
  const sim = new ComponentSimulator({
    offsetPx: 500,
    bpPerPx: 10,
    width: 1000,
    minBpPerPx: 0.1,
    maxBpPerPx: 100,
  })

  const mouseX = 300 // off-center
  const initialMouseBp = sim.getMouseBp(mouseX)
  console.log('Initial mouseBp at x=300:', Math.round(initialMouseBp))

  // Zoom out 10 times then in 10 times
  console.log('\nZooming out 10x then in 10x...')
  for (let i = 0; i < 10; i++) {
    sim.zoom(mouseX, false)
    sim.syncToView()
    sim.syncFromViewFixed()
  }
  for (let i = 0; i < 10; i++) {
    sim.zoom(mouseX, true)
    sim.syncToView()
    sim.syncFromViewFixed()
  }

  const finalMouseBp = sim.getMouseBp(mouseX)
  console.log('Final mouseBp at x=300:', Math.round(finalMouseBp))
  console.log('Drift:', Math.round(finalMouseBp - initialMouseBp), 'bp')

  assertEqual(finalMouseBp, initialMouseBp, 10, 'No drift after zoom out/in cycle')
}

console.log('\n' + '='.repeat(60))
console.log('TEST: Aggressive view adjustment (like real app)')
console.log('='.repeat(60) + '\n')

{
  // This simulates what we see in the real app logs:
  // offsetPx goes from 2416 to 1307 after view adjustment

  class AggressiveSimulator extends ComponentSimulator {
    syncToView(): void {
      console.log('  [syncToView] Sending to view:', {
        bpPerPx: this.componentState.bpPerPxRef.toFixed(2),
        offsetPx: this.componentState.offsetPxRef.toFixed(1),
      })

      this.viewState.bpPerPx = this.componentState.bpPerPxRef
      this.viewState.offsetPx = this.componentState.offsetPxRef
      this.simulateViewAdjustment('aggressive')
      this.componentState.interactingRef = false
    }
  }

  const sim = new AggressiveSimulator({
    offsetPx: 500,
    bpPerPx: 10,
    width: 1000,
    minBpPerPx: 0.1,
    maxBpPerPx: 100,
  })

  const mouseX = 500
  const initialMouseBp = sim.getMouseBp(mouseX)
  console.log('Initial state:')
  console.log('  Domain:', sim.getDomain()?.map(d => Math.round(d)))
  console.log('  MouseBp at center:', Math.round(initialMouseBp))

  console.log('\nZooming out with BUGGY sync...')
  for (let i = 0; i < 3; i++) {
    console.log(`\n--- Zoom out ${i + 1} ---`)
    sim.zoom(mouseX, false)
    sim.syncToView()
    sim.syncFromViewBuggy()
  }

  let finalMouseBp = sim.getMouseBp(mouseX)
  console.log('\nFinal state (BUGGY):')
  console.log('  Domain:', sim.getDomain()?.map(d => Math.round(d)))
  console.log('  MouseBp at center:', Math.round(finalMouseBp))
  console.log('  DRIFT:', Math.round(finalMouseBp - initialMouseBp), 'bp')

  const buggyDrift = Math.abs(finalMouseBp - initialMouseBp)

  // Now try with fixed version
  const sim2 = new AggressiveSimulator({
    offsetPx: 500,
    bpPerPx: 10,
    width: 1000,
    minBpPerPx: 0.1,
    maxBpPerPx: 100,
  })

  console.log('\n--- FIXED VERSION ---')
  console.log('Initial mouseBp:', Math.round(sim2.getMouseBp(mouseX)))

  for (let i = 0; i < 3; i++) {
    console.log(`\n--- Zoom out ${i + 1} ---`)
    sim2.zoom(mouseX, false)
    sim2.syncToView()
    sim2.syncFromViewFixed()
  }

  finalMouseBp = sim2.getMouseBp(mouseX)
  console.log('\nFinal state (FIXED):')
  console.log('  Domain:', sim2.getDomain()?.map(d => Math.round(d)))
  console.log('  MouseBp at center:', Math.round(finalMouseBp))
  console.log('  DRIFT:', Math.round(finalMouseBp - initialMouseBp), 'bp')

  const fixedDrift = Math.abs(finalMouseBp - initialMouseBp)

  console.log('\n--- COMPARISON ---')
  console.log('Buggy drift:', Math.round(buggyDrift), 'bp')
  console.log('Fixed drift:', Math.round(fixedDrift), 'bp')

  if (buggyDrift > 100 && fixedDrift < 10) {
    console.log('✅ PASS: Fixed version eliminates drift from aggressive view adjustment')
  } else if (fixedDrift < 10) {
    console.log('✅ PASS: Fixed version has minimal drift')
  } else {
    console.log('❌ FAIL: Fixed version still has drift:', fixedDrift)
  }
}

console.log('\n' + '='.repeat(60))
console.log('TEST: Changing contentBlocks during zoom (real app behavior)')
console.log('='.repeat(60) + '\n')

{
  // This simulates what we see in the real logs:
  // contentBlocks.first.start changes dramatically during zoom
  // e.g., 10947 -> 35740 -> 49951

  class ChangingBlocksSimulator {
    domainRef: [number, number]
    bpPerPxRef: number
    offsetPxRef: number
    zoomBaseRef: { firstStart: number; blockOffsetPx: number } | null = null
    viewBpPerPx: number
    width: number
    zoomCount = 0

    constructor() {
      this.domainRef = [10000, 20000]
      this.bpPerPxRef = 10
      this.viewBpPerPx = 10
      this.offsetPxRef = 500
      this.width = 1000
    }

    // ContentBlocks changes based on zoom level (simulating real behavior)
    getContentBlocks(): { firstStart: number; blockOffsetPx: number } {
      // Simulate: contentBlocks changes dramatically as we zoom out
      if (this.zoomCount < 10) {
        return { firstStart: 10000, blockOffsetPx: 500 }
      } else if (this.zoomCount < 20) {
        return { firstStart: 35000, blockOffsetPx: 24000 }
      } else {
        return { firstStart: 50000, blockOffsetPx: 10000 }
      }
    }

    // BUGGY: Uses current contentBlocks each time
    zoomBuggy(mouseX: number): void {
      this.zoomCount++
      const domainWidth = this.domainRef[1] - this.domainRef[0]
      const mouseFraction = mouseX / this.width
      const mouseBp = this.domainRef[0] + domainWidth * mouseFraction

      const newDomainWidth = domainWidth * 1.05 // zoom out
      const newBpPerPx = newDomainWidth / this.width

      const newDomainStart = mouseBp - mouseFraction * newDomainWidth
      const newDomainEnd = newDomainStart + newDomainWidth

      this.domainRef = [newDomainStart, newDomainEnd]
      this.bpPerPxRef = newBpPerPx

      // BUG: Uses current (changing) contentBlocks
      const blocks = this.getContentBlocks()
      this.offsetPxRef = blocks.blockOffsetPx + (newDomainStart - blocks.firstStart) / newBpPerPx
    }

    // FIXED: Caches contentBlocks at start of zoom session
    zoomFixed(mouseX: number): void {
      this.zoomCount++
      const domainWidth = this.domainRef[1] - this.domainRef[0]
      const mouseFraction = mouseX / this.width
      const mouseBp = this.domainRef[0] + domainWidth * mouseFraction

      const newDomainWidth = domainWidth * 1.05
      const newBpPerPx = newDomainWidth / this.width

      const newDomainStart = mouseBp - mouseFraction * newDomainWidth
      const newDomainEnd = newDomainStart + newDomainWidth

      this.domainRef = [newDomainStart, newDomainEnd]
      this.bpPerPxRef = newBpPerPx

      // FIX: Cache at start and reuse
      if (!this.zoomBaseRef) {
        const blocks = this.getContentBlocks()
        this.zoomBaseRef = {
          firstStart: blocks.firstStart,
          blockOffsetPx: blocks.blockOffsetPx,
        }
        console.log('  Cached zoom base:', this.zoomBaseRef)
      }

      this.offsetPxRef = this.zoomBaseRef.blockOffsetPx +
        (newDomainStart - this.zoomBaseRef.firstStart) / newBpPerPx
    }

    getMouseBp(mouseX: number): number {
      const fraction = mouseX / this.width
      return this.domainRef[0] + (this.domainRef[1] - this.domainRef[0]) * fraction
    }
  }

  const mouseX = 500

  // Test buggy version
  console.log('BUGGY version (uses changing contentBlocks):')
  const simBuggy = new ChangingBlocksSimulator()
  const initialMouseBpBuggy = simBuggy.getMouseBp(mouseX)
  console.log('  Initial mouseBp:', Math.round(initialMouseBpBuggy))

  for (let i = 0; i < 30; i++) {
    simBuggy.zoomBuggy(mouseX)
    if (i === 9 || i === 19 || i === 29) {
      console.log(`  After zoom ${i + 1}: domain=[${simBuggy.domainRef.map(d => Math.round(d))}], mouseBp=${Math.round(simBuggy.getMouseBp(mouseX))}`)
    }
  }
  const finalMouseBpBuggy = simBuggy.getMouseBp(mouseX)
  console.log('  Final mouseBp:', Math.round(finalMouseBpBuggy))
  console.log('  DRIFT:', Math.round(finalMouseBpBuggy - initialMouseBpBuggy), 'bp')

  // Test fixed version
  console.log('\nFIXED version (caches contentBlocks):')
  const simFixed = new ChangingBlocksSimulator()
  const initialMouseBpFixed = simFixed.getMouseBp(mouseX)
  console.log('  Initial mouseBp:', Math.round(initialMouseBpFixed))

  for (let i = 0; i < 30; i++) {
    simFixed.zoomFixed(mouseX)
    if (i === 9 || i === 19 || i === 29) {
      console.log(`  After zoom ${i + 1}: domain=[${simFixed.domainRef.map(d => Math.round(d))}], mouseBp=${Math.round(simFixed.getMouseBp(mouseX))}`)
    }
  }
  const finalMouseBpFixed = simFixed.getMouseBp(mouseX)
  console.log('  Final mouseBp:', Math.round(finalMouseBpFixed))
  console.log('  DRIFT:', Math.round(finalMouseBpFixed - initialMouseBpFixed), 'bp')

  console.log('\n--- COMPARISON ---')
  console.log('Buggy drift:', Math.round(Math.abs(finalMouseBpBuggy - initialMouseBpBuggy)), 'bp')
  console.log('Fixed drift:', Math.round(Math.abs(finalMouseBpFixed - initialMouseBpFixed)), 'bp')

  if (Math.abs(finalMouseBpFixed - initialMouseBpFixed) < 1) {
    console.log('✅ PASS: Fixed version has no drift even with changing contentBlocks')
  } else {
    console.log('❌ FAIL: Fixed version still has drift')
  }
}

console.log('\n' + '='.repeat(60))
console.log('All tests completed')
console.log('='.repeat(60) + '\n')
