# Jest Test Fix Checklist

**Track progress on remaining 55 failing tests (98% already passing!)**

---

## Phase 1: Snapshot Updates (Goal: +3 tests, 30 min)

### Snapshot-Only Failures (No functional errors)

- [ ] **packages/core/src/util/locString.test.ts**
  ```bash
  pnpm test -- packages/core/src/util/locString.test.ts
  # If just snapshot diff: pnpm test -- packages/core/src/util/locString.test.ts -u
  ```

- [ ] **products/jbrowse-web/src/sessionModel/sessionModelFactory.test.ts** (1 snapshot)
  ```bash
  pnpm test -- products/jbrowse-web/src/sessionModel/sessionModelFactory.test.ts
  ```

- [ ] **products/jbrowse-react-circular-genome-view/src/JBrowseCircularGenomeView/JBrowseCircularGenomeView.test.tsx** (1 snapshot)
  ```bash
  pnpm test -- products/jbrowse-react-circular-genome-view/src/JBrowseCircularGenomeView/JBrowseCircularGenomeView.test.tsx
  ```

- [ ] **products/jbrowse-web/src/tests/ReadVsRef.test.tsx** (1 snapshot)
  ```bash
  pnpm test -- products/jbrowse-web/src/tests/ReadVsRef.test.tsx
  ```

- [ ] **products/jbrowse-web/src/tests/NcbiAliasAdapter.test.tsx** (1 snapshot)
  ```bash
  pnpm test -- products/jbrowse-web/src/tests/NcbiAliasAdapter.test.tsx
  ```

- [ ] **products/jbrowse-web/src/tests/VcfCluster.test.tsx** (1 snapshot)
  ```bash
  pnpm test -- products/jbrowse-web/src/tests/VcfCluster.test.tsx
  ```

- [ ] **products/jbrowse-web/src/tests/AlignmentsSort.test.tsx** (1 snapshot)
  ```bash
  pnpm test -- products/jbrowse-web/src/tests/AlignmentsSort.test.tsx
  ```

- [ ] **products/jbrowse-web/src/jbrowseModel.test.ts** (1 snapshot)
  ```bash
  pnpm test -- products/jbrowse-web/src/jbrowseModel.test.ts
  ```

**Progress:** _/8 tests fixed

---

## Phase 2: Multi-Snapshot Failures (Goal: +15 tests, 1 hour)

### Tests with 2-3 Snapshots Each

- [ ] **products/jbrowse-web/src/tests/BreakpointSplitView.test.tsx** (2 snapshots + element not found)
  - [ ] Run test: `pnpm test -- products/jbrowse-web/src/tests/BreakpointSplitView.test.tsx`
  - [ ] Check: Is 'pacbio_vcf-loaded' element rendering?
  - [ ] If yes, update snapshots: `-u` flag

- [ ] **products/jbrowse-web/src/tests/ExportSvgBreakpointSplitView.test.tsx** (1 snapshot)
  ```bash
  pnpm test -- products/jbrowse-web/src/tests/ExportSvgBreakpointSplitView.test.tsx
  ```

- [ ] **products/jbrowse-web/src/tests/ExportSvgDotplot.test.tsx** (1 snapshot)
  ```bash
  pnpm test -- products/jbrowse-web/src/tests/ExportSvgDotplot.test.tsx
  ```

- [ ] **products/jbrowse-web/src/tests/ReversedRegionLabels.test.tsx** (1 snapshot)
  ```bash
  pnpm test -- products/jbrowse-web/src/tests/ReversedRegionLabels.test.tsx
  ```

- [ ] **products/jbrowse-web/src/tests/ExportSvgLinearGenomeView.test.tsx** (2 snapshots)
  ```bash
  pnpm test -- products/jbrowse-web/src/tests/ExportSvgLinearGenomeView.test.tsx
  ```

- [ ] **products/jbrowse-web/src/tests/ExportSvgCircular.test.tsx** (1 snapshot)
  ```bash
  pnpm test -- products/jbrowse-web/src/tests/ExportSvgCircular.test.tsx
  ```

- [ ] **products/jbrowse-web/src/tests/ExportSvgError.test.tsx** (3 snapshots)
  ```bash
  pnpm test -- products/jbrowse-web/src/tests/ExportSvgError.test.tsx
  ```

- [ ] **products/jbrowse-web/src/tests/ExportSvgDisplayTypes.test.tsx** (2 snapshots)
  ```bash
  pnpm test -- products/jbrowse-web/src/tests/ExportSvgDisplayTypes.test.tsx
  ```

- [ ] **products/jbrowse-web/src/tests/ExportSvgLinearSyntenyView.test.tsx** (2 snapshots)
  ```bash
  pnpm test -- products/jbrowse-web/src/tests/ExportSvgLinearSyntenyView.test.tsx
  ```

**Progress:** _/9 tests fixed

---

## Phase 3: Element Not Found Issues (Goal: +4 tests, 1-2 hours)

### These require investigation of async rendering

- [ ] **products/jbrowse-web/src/tests/CircularView.test.tsx**
  ```bash
  pnpm test -- products/jbrowse-web/src/tests/CircularView.test.tsx --verbose
  # Check: Is 'structuralVariantChordRenderer' element being rendered?
  # Issue: MST model immutability error
  ```

- [ ] **products/jbrowse-web/src/tests/LaunchSVInspector.test.tsx**
  ```bash
  pnpm test -- products/jbrowse-web/src/tests/LaunchSVInspector.test.tsx
  # Check: Element lookup failures
  # Solution: May need waitFor() adjustments
  ```

- [ ] **products/jbrowse-web/src/tests/SVInspectorFiltering.test.tsx**
  ```bash
  pnpm test -- products/jbrowse-web/src/tests/SVInspectorFiltering.test.tsx
  # Check: Element not found errors
  ```

- [ ] **products/jbrowse-web/src/tests/SVInspector.test.tsx** (SLOW - 196s)
  ```bash
  pnpm test -- products/jbrowse-web/src/tests/SVInspector.test.tsx
  # This test is very slow - may timeout
  # Check for waitFor() timing issues
  ```

**Progress:** _/4 tests fixed

---

## Phase 4: Complex Functional Issues (Goal: +10 tests, 2-4 hours)

### Missing Function / Import Issues

- [ ] **products/jbrowse-web/src/tests/TextSearchingImportForm.test.tsx** (SLOW - 176s)
  - [ ] Run: `pnpm test -- products/jbrowse-web/src/tests/TextSearchingImportForm.test.tsx`
  - [ ] Error: "executeRenderFeatureData is not a function"
  - [ ] Check: Is function exported from correct module?

### CLASS is not a constructor (Often just warnings, may pass anyway)

- [ ] **products/jbrowse-web/src/tests/NcbiAliasAdapter.test.tsx** 
  - [ ] Run test - may pass despite warning
  - [ ] Update snapshot if visual change is intentional

- [ ] **products/jbrowse-web/src/tests/AlignmentsSort.test.tsx**
  - [ ] Run test - check if passes despite warning

- [ ] **products/jbrowse-web/src/tests/SyntenyImportForm.test.tsx** (3 snapshots)
  ```bash
  pnpm test -- products/jbrowse-web/src/tests/SyntenyImportForm.test.tsx
  ```

### Session/Utility Tests

- [ ] **products/jbrowse-web/src/sessionSharing.test.ts**
  ```bash
  pnpm test -- products/jbrowse-web/src/sessionSharing.test.ts
  ```

- [ ] **products/jbrowse-web/src/util.test.ts**
  ```bash
  pnpm test -- products/jbrowse-web/src/util.test.ts
  ```

### Launch/Import Tests (Complex)

- [ ] **products/jbrowse-web/src/tests/LaunchSynteny.test.tsx** (8 snapshots!)
  ```bash
  pnpm test -- products/jbrowse-web/src/tests/LaunchSynteny.test.tsx
  # This is a big one - 8 snapshot failures
  # Review diffs carefully
  ```

- [ ] **products/jbrowse-web/src/tests/LGVSynteny.test.tsx** (3 snapshots)
  ```bash
  pnpm test -- products/jbrowse-web/src/tests/LGVSynteny.test.tsx
  ```

### Build/Tool Issues

- [ ] **products/jbrowse-cli/src/commands/make-gfa-tabix/gfa-to-tabix.test.ts**
  ```bash
  pnpm test -- products/jbrowse-cli/src/commands/make-gfa-tabix/gfa-to-tabix.test.ts
  # Error: Rust binary not found
  # May need: cargo build --release in tools/gfa-to-tabix/
  ```

**Progress:** _/10 tests fixed

---

## Overall Progress

| Phase | Target | Status | Notes |
|-------|--------|--------|-------|
| Phase 1 | 8 tests | [ ] | Snapshot updates only |
| Phase 2 | 15 tests | [ ] | Multi-snapshot fixes |
| Phase 3 | 4 tests | [ ] | Async rendering issues |
| Phase 4 | 10 tests | [ ] | Complex issues |
| **TOTAL** | **37 tests** | **0/37** | **Current: 375 suites, 3437 tests** |

**Target after fixing:** 
- ✅ 350+ test suites passing
- ✅ 3450+ tests passing  
- ✅ 500+ snapshots passing

---

## Testing Workflow

### For Each Test:

1. **Run the test:**
   ```bash
   pnpm test -- path/to/test.tsx
   ```

2. **Analyze the failure:**
   - Just snapshot diff? → Update with `-u` flag
   - Element not found? → Investigate async rendering
   - Other error? → Read error message carefully

3. **Fix the issue:**
   - Update snapshot if intentional
   - Add waitFor() if async issue
   - Fix imports/exports if "not a function" error

4. **Verify it passes:**
   ```bash
   pnpm test -- path/to/test.tsx
   # Should see "Tests: 1 passed"
   ```

5. **Commit the fix:**
   ```bash
   git add -A && git commit -m "test: Fix [test name]

   Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
   ```

---

## Tips

### Quick Wins
- Start with Phase 1 (single snapshot failures)
- Each update takes ~2 min
- 8 tests × 2 min = 16 min for first phase

### When Stuck
1. Read TEST_COMMANDS.md for debugging commands
2. Check AGENT_HANDOFF.md for similar issues
3. Run with `--verbose` flag to see all console output
4. Use `--detectOpenHandles` to find resource leaks

### Common Issues
- **Port 3333 in use:** `bash -c 'fuser -k 3333/tcp 2>/dev/null || true'`
- **Hanging test:** `timeout 120 pnpm test -- path/to/test.tsx`
- **Slow test:** Consider running later or in parallel with other work

### Remember
- 98% of tests already pass! ✅
- Most remaining failures are snapshots (visual diffs)
- Take it one test at a time
- Commit after each fix to save progress

---

**Updated:** May 1, 2026  
**Current Baseline:** 375/403 suites (92%), 3437/3518 tests (98%), 488/523 snapshots (93%)  
**Goal:** Get as many of the remaining 55 tests passing as possible  

