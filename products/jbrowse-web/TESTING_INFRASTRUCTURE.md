# Testing Infrastructure Notes

## WebGL Resource Exhaustion in Multi-Track Tests

### Problem
After running 4-5 tests with GPU-backed wiggle displays (especially MultiBigWig variants), the browser's WebGL implementation (swiftshader in headless Chrome) reaches a resource limit where:
1. New WebGL contexts are forcibly lost immediately upon creation
2. Shader compilation fails with cryptic errors
3. Tests crash with `ERR_INSUFFICIENT_RESOURCES`

### Root Cause
**This is NOT a code leak.** Detailed tracing confirms:
- GPU backends ARE properly disposed when tests complete
- WebGL2Hal.dispose() IS called for each context
- The disposal chain (useGpuRenderer → GpuWiggleRenderer → WebGL2Hal) works correctly

The issue is that swiftshader (Chrome's software WebGL implementation) doesn't immediately release GPU memory even after contexts are disposed. After 4-5 test cycles, the accumulated partial-release state causes new context creation to fail.

### Symptoms
- ERR_INSUFFICIENT_RESOURCES errors appear during page load
- "Shader compile error: null" when WebGL2 tries to initialize
- Context loss events followed by inability to recreate contexts
- Browser must be killed and restarted to recover

### Solution Implemented
Browser is recycled between each test that uses GPU rendering (particularly Multi-BigWig variants). This forces the Chrome GPU process to completely shut down and release all resources before the next test runs.

### Real User Implications
Users could experience similar resource exhaustion if they:
- Load many GPU-backed tracks/displays simultaneously
- Frequently add/remove tracks causing context creation/destruction cycles
- Use the app continuously without page refresh for extended periods

Mitigation strategies for production:
1. Implement canvas2d fallback when WebGL becomes unavailable
2. Pool/reuse WebGL contexts instead of creating new ones
3. Detect swiftshader limitations and warn users or disable GPU rendering
4. Add automatic page refresh after extended sessions with many track changes

### Testing Approach
- Use per-test browser recycling for GPU-heavy test suites
- Monitor WebGL context count in test output
- Run tests with `--backend=canvas2d` for comparison baseline
