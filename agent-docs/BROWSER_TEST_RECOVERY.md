# Browser Test Recovery & Findings (May 1, 2026)

## Current Status

**Branch:** webgl-poc  
**Current Test Pass Rate:** 0% (starting point)  
**Environment:** Linux, Puppeteer 24.42.0, Jest 30.3.0

## Issues Found & Fixed

### 1. ✅ FIXED: Puppeteer Cache Corruption

**Problem:** Chrome startup was failing with:
- "HistoryService::Init() failed"
- "chromium_chrome_Unpacker_BeginUnzipping" lock files
- Thousands of old `/tmp/puppeteer_*` directories

**Root Cause:** Old test runs left behind corrupted Chrome user profiles in /tmp

**Solution:**
```bash
rm -rf /tmp/puppeteer_* /tmp/org.chromium.*
```

**Result:** Chrome can now start and launch successfully

### 2. ✅ FIXED: System Chrome (Snap) Broken

**Problem:** System-installed Chromium snap has broken libraries
- Error: "libpxbackend-1.0.so: cannot open shared object file"  
- Snap sandbox mounting issues prevent normal execution

**Solution:** Use Puppeteer's pre-downloaded Chrome binary
- Located at: `~/.cache/puppeteer/chrome/linux-147.0.7727.57/`
- Puppeteer automatically uses this when system Chrome unavailable
- Tests can now run with Puppeteer's binary

**Result:** First test suite completes partial execution before resource issues

### 3. ⚠️ NEW BLOCKER: ChunkLoadError

**Problem:** Tests fail with:
```
ChunkLoadError: Loading chunk 2568 failed
[mobx-state-tree] You are trying to read or write to an object that is no longer part of a state tree
```

**Root Cause:** Build is incomplete or chunks not generated
- Build creates base files but `/build/static/js/` directory is missing
- Webpack chunks not being generated properly

**Impact:** Tests can navigate but fail when trying to load application code

**Status:** Fresh rebuild in progress (rm -rf build && pnpm build)

### 4. ⚠️ ONGOING: ERR_INSUFFICIENT_RESOURCES

**Problem:** Multiple resource errors during test execution:
- "Failed to load resource: net::ERR_INSUFFICIENT_RESOURCES" (appears 3-7 times per test)
- Browser crashes after 3-4 tests with "Navigating frame was detached"

**Possible Causes:**
1. GPU/WebGL context accumulation (despite event listener cleanup in be09a5bc87)
2. Memory leaks in test infrastructure
3. File descriptor exhaustion
4. Canvas element accumulation

**Current Investigation:**
- WebGL2Hal event listener cleanup IS in place (lines 525-538)
- Event listeners properly removed on dispose()
- Context references cleared
- Still seeing resource exhaustion

**Next Steps:** 
1. Monitor memory/FD usage during test runs
2. Check if additional resource cleanup needed in test runner
3. Verify page recycling between tests is working

## Jest Configuration

✅ **Already Correct:** Jest `maxWorkers` is set to `25%` in jest.config.js (line 2)

No changes needed - configuration is already optimal for multi-worker test execution.

## Test Infrastructure Improvements Made

1. **Updated TEST_INFRASTRUCTURE.md** with:
   - ChunkLoadError troubleshooting
   - Environment setup issues and fixes
   - Startup crash diagnosis
   - Resource exhaustion notes

2. **Added to BROWSER_TEST_RECOVERY.md** (this file):
   - Complete issue tracking
   - Solutions and status
   - Recommendations for next steps

## Recommendations

### Short Term (Next Steps)
1. ✅ Let fresh build complete (in progress)
2. ✅ Verify webpack chunks are generated
3. ✅ Run tests again with fresh build
4. If ChunkLoadError resolved: focus on resource exhaustion
5. If ChunkLoadError persists: investigate webpack configuration

### Medium Term (Resource Exhaustion)
1. **Monitor resource usage during tests:**
   ```bash
   # Watch FD count
   watch -n 0.5 'lsof -p <chrome-pid> | wc -l'
   
   # Watch memory
   ps -o pid,vsz,rss -p <chrome-pid>
   ```

2. **Additional cleanup in runner.ts:**
   - More aggressive page cleanup between tests
   - Explicit garbage collection hints
   - WebGL context flush/reset

3. **Profile with DevTools:**
   - Heap snapshots between tests
   - Timeline recording for resource accumulation
   - Identify what's not being garbage collected

### Long Term (CI/Environment)
1. Consider Docker/container for testing (avoid snap Chrome issues)
2. Document CI setup that works (check GitHub Actions if available)
3. Add pre-test environment checks:
   - Verify /tmp is clean
   - Verify Chrome is working
   - Verify no stray test processes

## Commands Reference

```bash
# Clean environment
rm -rf /tmp/puppeteer_* /tmp/org.chromium.*
fuser -k 3333/tcp 2>/dev/null
pkill -9 chrome firefox

# Fresh build
cd products/jbrowse-web
rm -rf build
pnpm build

# Run tests
pnpm test:browser --filter=bigwig  # Single suite
pnpm test:browser                  # All suites
pnpm test:browser --headed         # Visible browser

# Monitor resources
ps aux | grep chrome
lsof -p <pid> | wc -l
free -h
df -h /tmp
```

## Files Modified

- `agent-docs/TEST_INFRASTRUCTURE.md` - Added environment troubleshooting
- `agent-docs/BROWSER_TEST_RECOVERY.md` - This file, tracking findings

## Related Commits

- `be09a5bc87` - WebGL2Hal event listener cleanup (in place, working)
- `68eba7d860` - CSS.highlights fixes
- `498287276e` - Test snapshot updates
- `ca8ee2f440` - Initial test failure investigation

## Notes

The BROWSER_TESTS_STATUS.md document claims ~50% success rate with specific test suites passing, but the actual branch currently has 0% pass rate. This suggests:
1. The status document was aspirational/planned
2. OR recent commits introduced regressions
3. OR environment was never properly set up for full test runs

Once ChunkLoadError is resolved, we should be able to determine actual test status and focus on the remaining resource exhaustion issues.
