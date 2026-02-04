/**
 * Test file for zoom/sync logic
 * Run with: node --experimental-strip-types zoomLogic.test.ts
 */

// ============================================================
// EXTRACTED PURE FUNCTIONS (same logic as in component)
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
  contentBlocks: ContentBlock[]
}

/**
 * Compute domain from view state (same as syncDomainFromView)
 */
function computeDomainFromView(view: ViewState): [number, number] {
  const first = view.contentBlocks[0]
  const blockOffsetPx = first.offsetPx
  const deltaPx = view.offsetPx - blockOffsetPx
  const deltaBp = deltaPx * view.bpPerPx
  const domainStart = first.start + deltaBp
  const domainEnd = domainStart + view.width * view.bpPerPx
  return [domainStart, domainEnd]
}

/**
 * Compute offsetPx from domain (inverse of computeDomainFromView)
 */
function computeOffsetPxFromDomain(
  domain: [number, number],
  bpPerPx: number,
  contentBlocks: ContentBlock[],
): number {
  const first = contentBlocks[0]
  const blockOffsetPx = first.offsetPx
  const domainStart = domain[0]
  // Inverse: domainStart = first.start + (offsetPx - blockOffsetPx) * bpPerPx
  // So: offsetPx = blockOffsetPx + (domainStart - first.start) / bpPerPx
  return blockOffsetPx + (domainStart - first.start) / bpPerPx
}

/**
 * Zoom around a mouse position
 */
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

  // Position new domain so mouseBp stays at same screen position
  const newDomainStart = mouseBp - mouseFraction * newDomainWidth
  const newDomainEnd = newDomainStart + newDomainWidth

  return {
    domain: [newDomainStart, newDomainEnd],
    bpPerPx: newBpPerPx,
  }
}

// ============================================================
// TESTS
// ============================================================

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`)
    process.exit(1)
  }
  console.log(`✅ PASS: ${message}`)
}

function assertClose(a: number, b: number, epsilon: number, message: string) {
  const diff = Math.abs(a - b)
  if (diff > epsilon) {
    console.error(`❌ FAIL: ${message} (got ${a}, expected ${b}, diff ${diff})`)
    process.exit(1)
  }
  console.log(`✅ PASS: ${message}`)
}

console.log('\n=== Test 1: Domain <-> OffsetPx round-trip ===\n')
{
  const contentBlocks: ContentBlock[] = [
    { start: 50000, end: 60000, offsetPx: 100, refName: 'chr1' },
  ]
  const view: ViewState = {
    offsetPx: 200,
    bpPerPx: 10,
    width: 1000,
    contentBlocks,
  }

  // Compute domain from view
  const domain = computeDomainFromView(view)
  console.log('Initial view state:', view)
  console.log('Computed domain:', domain)

  // Compute offsetPx back from domain
  const recoveredOffsetPx = computeOffsetPxFromDomain(domain, view.bpPerPx, contentBlocks)
  console.log('Recovered offsetPx:', recoveredOffsetPx)

  assertClose(recoveredOffsetPx, view.offsetPx, 0.001, 'OffsetPx round-trip')
}

console.log('\n=== Test 2: Zoom preserves mouse position ===\n')
{
  const width = 1000
  const initialDomain: [number, number] = [50000, 60000] // 10000bp, 10bp/px
  const mouseX = 500 // middle of screen
  const mouseBpBefore = initialDomain[0] + (initialDomain[1] - initialDomain[0]) * (mouseX / width)
  console.log('Mouse bp before zoom:', mouseBpBefore) // Should be 55000

  // Zoom in
  const result = zoomAtPosition(initialDomain, mouseX, width, true)
  console.log('After zoom in:', result)

  const mouseBpAfter = result.domain[0] + (result.domain[1] - result.domain[0]) * (mouseX / width)
  console.log('Mouse bp after zoom:', mouseBpAfter)

  assertClose(mouseBpBefore, mouseBpAfter, 0.001, 'Mouse position preserved after zoom')
}

console.log('\n=== Test 3: Zoom then sync round-trip ===\n')
{
  // This simulates what happens:
  // 1. We have a view state
  // 2. User zooms - we compute new domain
  // 3. We compute offsetPx from domain to sync to view
  // 4. View updates and we compute domain from view again
  // 5. Domain should match what we set in step 2

  const contentBlocks: ContentBlock[] = [
    { start: 50000, end: 60000, offsetPx: 100, refName: 'chr1' },
  ]
  const width = 1000
  const initialBpPerPx = 10

  // Initial state
  const initialView: ViewState = {
    offsetPx: 200,
    bpPerPx: initialBpPerPx,
    width,
    contentBlocks,
  }
  const initialDomain = computeDomainFromView(initialView)
  console.log('1. Initial domain:', initialDomain)

  // Zoom in at center
  const mouseX = 500
  const zoomResult = zoomAtPosition(initialDomain, mouseX, width, true)
  console.log('2. After zoom, new domain:', zoomResult.domain)
  console.log('   New bpPerPx:', zoomResult.bpPerPx)

  // Back-calculate offsetPx (this is what component does)
  const newOffsetPx = computeOffsetPxFromDomain(zoomResult.domain, zoomResult.bpPerPx, contentBlocks)
  console.log('3. Back-calculated offsetPx:', newOffsetPx)

  // Simulate view.setNewView - view now has our values
  const afterSyncView: ViewState = {
    offsetPx: newOffsetPx,
    bpPerPx: zoomResult.bpPerPx,
    width,
    contentBlocks,
  }

  // When sync effect runs, it computes domain from view
  const recoveredDomain = computeDomainFromView(afterSyncView)
  console.log('4. Recovered domain from view:', recoveredDomain)

  assertClose(recoveredDomain[0], zoomResult.domain[0], 0.001, 'Domain start preserved after sync')
  assertClose(recoveredDomain[1], zoomResult.domain[1], 0.001, 'Domain end preserved after sync')
}

console.log('\n=== Test 4: Multiple zoom steps ===\n')
{
  const contentBlocks: ContentBlock[] = [
    { start: 50000, end: 60000, offsetPx: 100, refName: 'chr1' },
  ]
  const width = 1000

  let domain: [number, number] = [50000, 60000]
  let bpPerPx = 10

  console.log('Initial domain:', domain)

  // Zoom in 5 times at position 300 (30% from left)
  const mouseX = 300
  for (let i = 0; i < 5; i++) {
    const mouseBpBefore = domain[0] + (domain[1] - domain[0]) * (mouseX / width)

    const result = zoomAtPosition(domain, mouseX, width, true)
    domain = result.domain
    bpPerPx = result.bpPerPx

    const mouseBpAfter = domain[0] + (domain[1] - domain[0]) * (mouseX / width)

    console.log(`Zoom ${i + 1}: domain=${domain.map(d => d.toFixed(1))}, bpPerPx=${bpPerPx.toFixed(4)}, mouseBp: ${mouseBpBefore.toFixed(1)} -> ${mouseBpAfter.toFixed(1)}`)
    assertClose(mouseBpBefore, mouseBpAfter, 0.01, `Zoom ${i + 1}: mouse position preserved`)
  }
}

console.log('\n=== Test 5: Zoom + sync with contentBlock.offsetPx = 0 ===\n')
{
  // This is the common case where contentBlock starts at offsetPx 0
  const contentBlocks: ContentBlock[] = [
    { start: 10000, end: 20000, offsetPx: 0, refName: 'chr1' },
  ]
  const width = 1000

  // View is scrolled to show region starting at 15000
  // offsetPx = blockOffsetPx + (domainStart - first.start) / bpPerPx
  // 500 = 0 + (15000 - 10000) / 10
  // 500 = 5000 / 10 ✓
  const initialView: ViewState = {
    offsetPx: 500,
    bpPerPx: 10,
    width,
    contentBlocks,
  }

  const initialDomain = computeDomainFromView(initialView)
  console.log('1. Initial domain:', initialDomain) // Should be [15000, 25000]

  // Zoom in at center (mouseX = 500, which is at bp 20000)
  const mouseX = 500
  const zoomResult = zoomAtPosition(initialDomain, mouseX, width, true)
  console.log('2. After zoom, new domain:', zoomResult.domain)

  // Back-calculate offsetPx
  const newOffsetPx = computeOffsetPxFromDomain(zoomResult.domain, zoomResult.bpPerPx, contentBlocks)
  console.log('3. Back-calculated offsetPx:', newOffsetPx)

  // Verify round-trip
  const afterSyncView: ViewState = {
    offsetPx: newOffsetPx,
    bpPerPx: zoomResult.bpPerPx,
    width,
    contentBlocks,
  }
  const recoveredDomain = computeDomainFromView(afterSyncView)
  console.log('4. Recovered domain:', recoveredDomain)

  assertClose(recoveredDomain[0], zoomResult.domain[0], 0.001, 'Domain start preserved')
  assertClose(recoveredDomain[1], zoomResult.domain[1], 0.001, 'Domain end preserved')
}

console.log('\n=== Test 6: What if contentBlock.offsetPx changes after zoom? ===\n')
{
  // This simulates what might happen if the view recalculates contentBlocks
  // after we set the new bpPerPx

  const width = 1000

  // Before zoom: contentBlock at offsetPx 100
  const contentBlocksBefore: ContentBlock[] = [
    { start: 50000, end: 60000, offsetPx: 100, refName: 'chr1' },
  ]

  const initialView: ViewState = {
    offsetPx: 200,
    bpPerPx: 10,
    width,
    contentBlocks: contentBlocksBefore,
  }

  const initialDomain = computeDomainFromView(initialView)
  console.log('1. Initial domain:', initialDomain)

  // Zoom in
  const mouseX = 500
  const zoomResult = zoomAtPosition(initialDomain, mouseX, width, true)
  console.log('2. After zoom, target domain:', zoomResult.domain)

  // Back-calculate offsetPx using BEFORE contentBlocks
  const newOffsetPx = computeOffsetPxFromDomain(zoomResult.domain, zoomResult.bpPerPx, contentBlocksBefore)
  console.log('3. Calculated offsetPx (using before blocks):', newOffsetPx)

  // But what if after setNewView, the view recalculates and contentBlocks changes?
  // For example, blockOffsetPx might change based on the new bpPerPx
  // Let's simulate: blockOffsetPx changes to a different value
  const contentBlocksAfter: ContentBlock[] = [
    { start: 50000, end: 60000, offsetPx: 50, refName: 'chr1' }, // Changed!
  ]

  const afterSyncView: ViewState = {
    offsetPx: newOffsetPx,
    bpPerPx: zoomResult.bpPerPx,
    width,
    contentBlocks: contentBlocksAfter, // Using CHANGED blocks
  }

  const recoveredDomain = computeDomainFromView(afterSyncView)
  console.log('4. Recovered domain (with changed blocks):', recoveredDomain)
  console.log('   Expected domain:', zoomResult.domain)
  console.log('   DRIFT:', recoveredDomain[0] - zoomResult.domain[0], 'bp')

  // This WILL fail if contentBlocks change!
  const domainDrift = Math.abs(recoveredDomain[0] - zoomResult.domain[0])
  if (domainDrift > 1) {
    console.log('\n⚠️  This test shows the problem: if contentBlocks change after zoom,')
    console.log('   the domain will drift. The drift is proportional to the change in blockOffsetPx.')
  }
}

console.log('\n=== Test 7: Correct approach - domain as source of truth ===\n')
{
  // The fix: DON'T recompute domain from view after zoom.
  // Keep domain as source of truth, only update it on external changes.

  const width = 1000

  // Simulate state
  let domainRef: [number, number] = [50000, 60000]
  let bpPerPxRef = 10
  let offsetPxRef = 0 // doesn't matter for rendering

  // Content blocks (will change when bpPerPx changes)
  function getContentBlocks(bpPerPx: number): ContentBlock[] {
    // Simulate: blockOffsetPx changes with bpPerPx
    return [{ start: 50000, end: 60000, offsetPx: 100 / bpPerPx * 10, refName: 'chr1' }]
  }

  console.log('Initial domain:', domainRef)

  // User zooms at center
  const mouseX = 500
  for (let i = 0; i < 3; i++) {
    const mouseBpBefore = domainRef[0] + (domainRef[1] - domainRef[0]) * (mouseX / width)

    // 1. Zoom - update domain directly (this is correct)
    const zoomResult = zoomAtPosition(domainRef, mouseX, width, true)
    domainRef = zoomResult.domain
    bpPerPxRef = zoomResult.bpPerPx

    // 2. Calculate offsetPx for view sync (using current content blocks)
    const contentBlocks = getContentBlocks(bpPerPxRef)
    offsetPxRef = computeOffsetPxFromDomain(domainRef, bpPerPxRef, contentBlocks)

    // 3. Simulate: view.setNewView(bpPerPxRef, offsetPxRef)
    //    This would trigger view to update contentBlocks...

    // 4. IMPORTANT: We do NOT call syncDomainFromView here!
    //    We keep our domain as the source of truth.

    const mouseBpAfter = domainRef[0] + (domainRef[1] - domainRef[0]) * (mouseX / width)
    console.log(`Zoom ${i + 1}: domain=${domainRef.map(d => d.toFixed(1))}, mouseBp preserved: ${mouseBpBefore.toFixed(1)} == ${mouseBpAfter.toFixed(1)}`)
    assertClose(mouseBpBefore, mouseBpAfter, 0.01, `Zoom ${i + 1}: mouse position preserved`)
  }

  console.log('\n✅ Key insight: By NOT recalculating domain from view after zoom,')
  console.log('   we avoid the drift caused by contentBlocks.offsetPx changing.')
}

console.log('\n=== Test 8: Zoom OUT behavior ===\n')
{
  const width = 1000
  const contentBlocks: ContentBlock[] = [
    { start: 50000, end: 100000, offsetPx: 0, refName: 'chr1' },
  ]

  let domain: [number, number] = [55000, 60000] // 5000bp span, 5 bp/px
  let bpPerPx = 5

  console.log('Initial domain:', domain, 'bpPerPx:', bpPerPx)

  // Zoom OUT at center (deltaY > 0)
  const mouseX = 500
  for (let i = 0; i < 10; i++) {
    const mouseBpBefore = domain[0] + (domain[1] - domain[0]) * (mouseX / width)

    // Zoom out (zoomIn = false)
    const result = zoomAtPosition(domain, mouseX, width, false)
    domain = result.domain
    bpPerPx = result.bpPerPx

    // Calculate offsetPx
    const offsetPx = computeOffsetPxFromDomain(domain, bpPerPx, contentBlocks)

    const mouseBpAfter = domain[0] + (domain[1] - domain[0]) * (mouseX / width)

    console.log(`Zoom out ${i + 1}:`, {
      domain: domain.map(d => d.toFixed(0)),
      bpPerPx: bpPerPx.toFixed(2),
      offsetPx: offsetPx.toFixed(1),
      domainWidth: (domain[1] - domain[0]).toFixed(0),
    })

    // Check if domain goes outside contentBlock bounds
    if (domain[0] < contentBlocks[0].start) {
      console.log(`  ⚠️ Domain start ${domain[0].toFixed(0)} < contentBlock start ${contentBlocks[0].start}`)
    }
    if (domain[1] > contentBlocks[0].end) {
      console.log(`  ⚠️ Domain end ${domain[1].toFixed(0)} > contentBlock end ${contentBlocks[0].end}`)
    }

    assertClose(mouseBpBefore, mouseBpAfter, 0.01, `Zoom out ${i + 1}: mouse position preserved`)
  }
}

console.log('\n=== Test 9: Zoom OUT with negative offsetPx ===\n')
{
  // Test what happens when domain extends before contentBlock.start
  const width = 1000
  const contentBlocks: ContentBlock[] = [
    { start: 50000, end: 100000, offsetPx: 500, refName: 'chr1' }, // blockOffsetPx is 500
  ]

  // Domain starts at contentBlock start
  let domain: [number, number] = [50000, 60000]
  let bpPerPx = 10

  console.log('Initial: domain', domain, 'blockOffsetPx', contentBlocks[0].offsetPx)

  // Zoom out - domain will expand to include region BEFORE contentBlock.start
  const mouseX = 500
  for (let i = 0; i < 5; i++) {
    const result = zoomAtPosition(domain, mouseX, width, false)
    domain = result.domain
    bpPerPx = result.bpPerPx

    const offsetPx = computeOffsetPxFromDomain(domain, bpPerPx, contentBlocks)

    console.log(`Zoom out ${i + 1}: domain=[${domain[0].toFixed(0)}, ${domain[1].toFixed(0)}], offsetPx=${offsetPx.toFixed(1)}`)

    if (domain[0] < contentBlocks[0].start) {
      const deltaBp = domain[0] - contentBlocks[0].start
      console.log(`  Domain extends ${Math.abs(deltaBp).toFixed(0)}bp before contentBlock.start`)
      console.log(`  This maps to offsetPx = ${offsetPx.toFixed(1)} (negative means scrolled left of block start)`)
    }
  }
}

console.log('\n=== All tests completed ===\n')
