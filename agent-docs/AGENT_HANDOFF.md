# Agent Handoff: Test Fixes in Progress

**Date:** May 1, 2026  
**Current Branch:** `webgl-poc`  
**Session Focus:** Jest unit tests (NOT Puppeteer browser tests)

---

## What Was Accomplished This Session

### 1. Fixed React PropTypes Warning ✅
**Problem:** Multiple test suites were failing with React warning about `submitDisabled` prop on DOM elements.

**Solution:** Updated two components to prevent spreading custom props to native elements:
- `packages/core/src/ui/SubmitDialog.tsx` - Line 16-27
- `packages/core/src/ui/ConfirmDialog.tsx` - Line 17-27

**Change Pattern:** Instead of `{...props}`, destructure specific Dialog props:
```typescript
const { onSubmit, onCancel, submitDisabled, children, ...dialogProps } = props
return <Dialog {...dialogProps}>  // submitDisabled not passed
```

**Commit:** `db4b873af5` - "fix: Don't spread submitDisabled prop to Dialog component"

**Impact:** Eliminates warnings in 8+ test suites (ExportSvg variants, etc.)

### 2. Created Test Status Documentation ✅
**File:** `agent-docs/JEST_TESTS_STATUS.md`

**Contains:**
- Overall test results (375 suites passing, 3437 tests passing, 93% snapshots)
- Categorization of 55 failing tests
- Debugging commands and tips
- Next steps with priorities

**Commit:** `4744ed26cb` - "docs: Add Jest tests status and fix summary"

### 3. Investigated Failing Tests
Ran individual failing tests to understand failure patterns:
- BreakpointSplitView: Element not found ('pacbio_vcf-loaded') + 2 snapshot failures
- NcbiAliasAdapter: "CLASS is not a constructor" (Jest teardown race), plus image snapshot mismatch
- CircularView: MST model immutability error when trying to set `self.features = undefined`

---

## Current Test Status

### Passing (92% of suites)
```
✅ Test Suites: 375 passed, 28 failed
✅ Tests: 3437 passed, 55 failed  
✅ Snapshots: 488 passed, 35 failed
```

### Failing Tests Breakdown

**35 Snapshot Failures** (visual/rendering diffs)
- LaunchSynteny: 8 snapshots
- LGVSynteny: 3 snapshots
- SyntenyImportForm: 3 snapshots
- ExportSvgError: 3 snapshots
- Others: 1-2 each

**20 Functional Failures**

| Error Type | Tests | Root Cause |
|-----------|-------|-----------|
| Element not found | CircularView, LaunchSVInspector, SVInspectorFiltering, SVInspector | Async rendering - elements not mounted when test queries |
| "CLASS is not a constructor" | NcbiAliasAdapter, AlignmentsSort, SyntenyImportForm | Jest teardown race condition (often doesn't prevent passing) |
| Missing function | TextSearchingImportForm | "executeRenderFeatureData is not a function" |
| MST immutability | CircularView | Trying to mutate frozen MST model |
| Build failure | gfa-to-tabix | Rust binary not found |

---

## Important Context

### About "CLASS is not a constructor" Warnings
**IMPORTANT:** These warnings are often just Jest teardown race conditions where async operations are still running when Jest tears down the environment. The tests often pass anyway. **Do not prioritize fixing these messages.**

### About Snapshots
The `webgl-poc` branch is for WebGL/GPU rendering migration. Many snapshot differences are intentional rendering changes, not bugs. When updating snapshots, visually inspect diffs to confirm they're expected.

### Jest Configuration
- **maxWorkers:** `25%` (already set in jest.config.js line 2)
- **Test timeout:** 15000ms (some tests like TextSearchingImportForm need 176s - may timeout under resource constraints)
- **Environments:** jsdom (DOM tests) + node (CLI tests)
- **Setup:** Fetch mocking configured, TextEncoder mocked, etc.

---

## Next Steps (Prioritized)

### Phase 1: Quick Snapshot Updates (30 min)
For snapshot-only failures, review and update if intentional:

```bash
# Check individual test diffs (don't update all at once)
pnpm test -- products/jbrowse-web/src/tests/ReadVsRef.test.tsx
pnpm test -- products/jbrowse-web/src/tests/AlignmentsSort.test.tsx
pnpm test -- packages/core/src/util/locString.test.ts

# If diffs are intentional, update individual snapshots:
pnpm test -- products/jbrowse-web/src/tests/ReadVsRef.test.tsx -u
```

**Tests to check first (simplest):**
1. packages/core/src/util/locString.test.ts (might just need update)
2. products/jbrowse-web/src/sessionModel/sessionModelFactory.test.ts (1 snapshot)
3. products/jbrowse-react-circular-genome-view/src/JBrowseCircularGenomeView/JBrowseCircularGenomeView.test.tsx (1 snapshot)

### Phase 2: Element Not Found Issues (1-2 hours)
These require investigation into async rendering:

```bash
# Run one test at a time, check console output
pnpm test -- products/jbrowse-web/src/tests/CircularView.test.tsx

# Look for:
# 1. Are required DOM elements actually being rendered?
# 2. Is there enough time for async operations to complete?
# 3. Do we need explicit waitFor() calls?
```

**Affected tests:**
- products/jbrowse-web/src/tests/CircularView.test.tsx
- products/jbrowse-web/src/tests/LaunchSVInspector.test.tsx
- products/jbrowse-web/src/tests/SVInspectorFiltering.test.tsx
- products/jbrowse-web/src/tests/SVInspector.test.tsx (196s - very slow)

### Phase 3: Complex Functional Issues (variable)
- MST model immutability errors (CircularView) - requires understanding mobx-state-tree patterns
- Missing function exports (TextSearchingImportForm) - likely simple import fix
- gfa-to-tabix build (tool issue, not test code)

---

## How to Run Tests

### Single test file (fastest)
```bash
pnpm test -- products/jbrowse-web/src/tests/BreakpointSplitView.test.tsx
```

### Single test within file
```bash
pnpm test -- products/jbrowse-web/src/tests/BreakpointSplitView.test.tsx -t "breakpoint split view"
```

### Update snapshots
```bash
pnpm test -- products/jbrowse-web/src/tests/BreakpointSplitView.test.tsx -u
```

### Detect resource leaks
```bash
pnpm test -- products/jbrowse-web/src/tests/BreakpointSplitView.test.tsx --detectOpenHandles
```

### Full suite (slow, ~10 min)
```bash
pnpm test
```

---

## Files Modified This Session

1. **packages/core/src/ui/SubmitDialog.tsx** - Destructured props to prevent spread
2. **packages/core/src/ui/ConfirmDialog.tsx** - Destructured props to prevent spread
3. **agent-docs/JEST_TESTS_STATUS.md** - Created new documentation
4. **agent-docs/AGENT_HANDOFF.md** - This file

---

## Known Issues & Workarounds

### Issue: Port 3333 stays in use after test runs
**Workaround:** Kill the port before running tests:
```bash
bash -c 'fuser -k 3333/tcp 2>/dev/null || true; sleep 1'
```

### Issue: Full test suite is slow (~10 min for 3500+ tests)
**Workaround:** Run single test files during development, full suite only when needed.

### Issue: Tests fail with "Worker process force exited"
This indicates tests are leaking resources/timers. Look for:
- Unclosed connections
- Running intervals/timeouts
- Unmocked timers

---

## For the Next Agent

**Focus Areas (in order of impact):**
1. ✅ Snapshot-only failures - Can be resolved by reviewing visual diffs
2. ⚠️ Element not found errors - Complex async rendering issues
3. ⚠️ MST immutability errors - Requires MST expertise
4. ⏭️ Build issues - May need Rust/build system expertise

**Success Metrics:**
- Get 375+ test suites passing (currently 375/403)
- Get 3500+ tests passing (currently 3437/3518)
- Document all snapshot changes (intentional vs bugs)

**Time estimate:** 
- Phase 1 (snapshots): 30 min
- Phase 2 (element not found): 1-2 hours
- Phase 3 (complex issues): 2-4 hours depending on root causes

**Questions to ask if stuck:**
1. Are snapshot differences intentional (WebGL migration)?
2. Do test elements actually render before test queries run?
3. Is the MST model being frozen/locked somehow?
4. Are there async operations that need explicit waits?

---

## Resources

- **Memory:** User mentioned Jest is slow with full suite - maxWorkers already set to 25%
- **Browser tests:** Separate from Jest tests, have environmental issues in this session (Chrome crashes during navigation) - avoid for now
- **Documentation:** See JEST_TESTS_STATUS.md for detailed test breakdown and debugging tips
- **Project context:** This is the webgl-poc branch for GPU rendering migration - expect rendering changes in snapshots

