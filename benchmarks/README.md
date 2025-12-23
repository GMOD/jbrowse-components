# readConfObject Performance Benchmarks

This directory contains benchmarks and analysis for `readConfObject` from `packages/core/configuration`.

## Quick Start

```bash
# Run the comprehensive overhead analysis
node benchmarks/readConfObject_overhead_analysis.mjs

# With CPU profiling
node --cpu-prof benchmarks/readConfObject_overhead_analysis.mjs
```

Then open the `.cpuprofile` file in Chrome DevTools to see where time is spent.

## Benchmarks

### 1. `readConfObject_overhead_analysis.mjs` (RECOMMENDED)

Isolates and measures each source of overhead in `readConfObject`:
- JSON serialization overhead (60-100x slowdown for objects/arrays)
- MST type checking overhead (<1% - not a problem)
- Property access overhead (negligible)
- Jexl expression evaluation (10-50x slowdown)

**Key Finding**: The main bottleneck is `JSON.parse(JSON.stringify(getSnapshot(val)))` on line 71 of `packages/core/configuration/util.ts`, which is done for defensive copying of object/array config values.

### 2. `structuredClone_vs_json.mjs`

Compares `JSON.parse(JSON.stringify())` vs `structuredClone()` for deep cloning.

**Finding**: Results are mixed - neither is clearly better. The best fix is to **avoid cloning entirely** when it's safe to do so (most rendering code doesn't mutate config values).

## Key Findings

### MST Itself is NOT the Bottleneck

- `isStateTreeNode`, `getType`, `isMapType`: <10ms per 100K operations
- Less than 1% of total overhead
- **MST type checking is extremely fast**

### The Real Bottlenecks

1. **JSON Serialization** (MAJOR - 60-100x slowdown):
   - Affects 65 `fileLocation` slots + 32 `stringArray` slots
   - Happens on EVERY `readConfObject` call for these types
   - Done for defensive copying to prevent mutations

2. **Jexl Evaluation** (MODERATE - 10-50x slowdown):
   - Affects all config slots with `jexl:` expressions
   - Worse when expressions can't short-circuit
   - Calling `eval()` 100,000+ times in tight loops is expensive

3. **Calling readConfObject in Hot Loops** (MAJOR in real code):
   - Even primitive reads add up when called thousands of times
   - Should read config once outside loops when possible

## Performance Recommendations

See **`PERFORMANCE_RECOMMENDATIONS.md`** for detailed optimization strategies, including:

1. **Avoid defensive copying when safe** (60-100x speedup)
   - Most rendering code doesn't mutate config values
   - Consider returning `getSnapshot(val)` directly
   - Or add `readConfObjectUnsafe()` for hot paths

2. **Cache config values outside hot loops** (HIGH IMPACT)
   - ✓ Already done well in PileupRenderer and CanvasFeatureRenderer!
   - See good patterns in `plugins/canvas/src/CanvasFeatureRenderer/renderConfig.ts`
   - Avoid calling `readConfObject` inside feature loops

3. **Add memoization for repeated reads** (MEDIUM)
   - Cache results keyed by config + args
   - Tradeoff: memory usage and cache invalidation complexity

4. **Fast path for primitives** (LOW hanging fruit)
   - Skip `isStateTreeNode` check for primitives
   - Small but measurable improvement

## Good Patterns Already in Use

The codebase already has excellent optimization patterns:

### CanvasFeatureRenderer (`plugins/canvas/src/CanvasFeatureRenderer/renderConfig.ts`)

```typescript
/**
 * IMPORTANT: Config Reading Performance Optimization
 *
 * Reading config values via readConfObject is expensive because:
 * 1. It may involve JEXL expression evaluation
 * 2. It traverses the config tree
 * 3. It can trigger MobX reactions
 *
 * SOLUTION: Read all non-feature-dependent config values ONCE
 * and pass them through as a context object.
 */
```

This pattern should be adopted elsewhere.

### PileupRenderer (`plugins/alignments/src/PileupRenderer/makeImageData.ts`)

Reads all config values before the rendering loop - ✓ GOOD!

## Anti-Pattern to Avoid

**BAD**:
```typescript
for (const feature of features) {
  const color = readConfObject(config, 'color', { feature })  // ✗ Called N times
}
```

**GOOD**:
```typescript
const isColorCallback = config.color.expr !== null
const colorStatic = isColorCallback ? null : readConfObject(config, 'color')

for (const feature of features) {
  const color = isColorCallback
    ? readConfObject(config, 'color', { feature })  // Only if callback
    : colorStatic                                     // Use cached
}
```

## Analyzing CPU Profiles

1. Run benchmark with `--cpu-prof` flag
2. Open Chrome and go to `chrome://inspect`
3. Click "Open dedicated DevTools for Node"
4. Go to Profiler tab
5. Load the generated `.cpuprofile` file
6. Look for time spent in:
   - `JSON.parse` and `JSON.stringify`
   - `evalSync` (jexl evaluation)
   - `readConfObject` itself

## Implementation Priority

1. **HIGH**: Audit renderer code for config reads in loops
2. **MEDIUM**: Consider removing defensive copying where safe
3. **MEDIUM**: Add fast path for primitive values
4. **LOW**: Add memoization for specific hot paths
5. **LOW**: Add `readConfObjectUnsafe()` API for advanced users
