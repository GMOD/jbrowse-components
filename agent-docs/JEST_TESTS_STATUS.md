# Jest Tests Status & Fixes

## Current Status (May 1, 2026)

**Overall Results:**
- ✅ **Test Suites:** 375 passed, 28 failed (92% pass rate)
- ✅ **Tests:** 3437 passed, 55 failed (98% pass rate)  
- ✅ **Snapshots:** 488 passed, 35 failed (93% pass rate)

**Configuration:**
- Jest maxWorkers: `25%` (configured in jest.config.js line 2)
- Test timeout: 15000ms

---

## Fixed Issues

### 1. React `submitDisabled` Prop Warning

**Problem:** Tests were showing React warning:
```
React does not recognize the `submitDisabled` prop on a DOM element.
```

**Root Cause:** The `submitDisabled` prop (custom component prop) was being spread onto the underlying Dialog component, which eventually renders to a native HTML element.

**Files Fixed:**
- `packages/core/src/ui/SubmitDialog.tsx` 
- `packages/core/src/ui/ConfirmDialog.tsx`

**Solution:** Explicitly destructure custom props and rest operator, preventing them from being spread to Dialog:
```typescript
const { onSubmit, onCancel, ..., ...dialogProps } = props
return <Dialog {...dialogProps}>
```

**Impact:** Eliminates warnings in these test suites:
- ExportSvgLinearGenomeView
- ExportSvgBreakpointSplitView  
- ReversedRegionLabels
- ExportSvgCircular
- ExportSvgDotplot
- ExportSvgDisplayTypes
- ExportSvgLinearGenomeView
- ExportSvgError
- SyntenyImportForm (potentially)

**Commit:** `db4b873af5` - fix: Don't spread submitDisabled prop to Dialog component

---

## Remaining Failures (55 tests)

### By Category

**1. Snapshot Failures (35 snapshots)**
- Expected: Snapshot updates or rendering changes detected
- Action: Review visual changes and update snapshots if intentional
- Tests affected:
  - LaunchSynteny (8 snapshots)
  - LGVSynteny (3 snapshots)
  - SyntenyImportForm (3 snapshots)
  - ExportSvgError (3 snapshots)
  - ExportSvgLinearSyntenyView (2 snapshots)
  - ExportSvgLinearGenomeView (2 snapshots)
  - ExportSvgBreakpointSplitView (1 snapshot)
  - ExportSvgDotplot (1 snapshot)
  - ExportSvgDisplayTypes (2 snapshots)
  - Others (1-2 each)

**2. Functional Failures (~20 tests)**

**Error: "CLASS is not a constructor"**
- Files: SyntenyImportForm, AlignmentsSort
- Likely Issue: Import/export or class instantiation bug
- Need: Investigate class/constructor usage

**Error: "executeRenderFeatureData is not a function"**
- Files: TextSearchingImportForm  
- Need: Check function export/import

**Element Not Found Errors**
- CircularView: structuralVariantChordRenderer
- LaunchSVInspector: (various selectors)
- SVInspectorFiltering: (various selectors)
- SVInspector: (large test, 196s runtime)
- Need: Wait for element rendering or verify component mounting

**Other Issues:**
- NcbiAliasAdapter: snapshot + functional issue
- VcfCluster: snapshot + functional issue
- BreakpointSplitView: 2 snapshots failed
- ReadVsRef: 1 snapshot failed
- sessionModelFactory: 1 snapshot failed
- jbrowseModel: 1 snapshot failed
- JBrowseCircularGenomeView: 1 snapshot failed

**3. Build Issues (1 test)**
- gfa-to-tabix: Rust binary not found
- Error: Command failed for gfa-to-tabix tool
- Need: Verify Rust binary build status

---

## Next Steps (Prioritized)

### Phase 1: Quick Wins (Snapshot Updates)
1. Review and update intentional snapshot changes
2. Run `pnpm test -- -u` on specific suites to update
3. Verify visual/structural changes are expected

### Phase 2: Functional Fixes
1. **CLASS is not a constructor** - Debug SyntenyImportForm, AlignmentsSort
2. **Missing function exports** - Fix TextSearchingImportForm
3. **Element not found** - Investigate CircularView, LaunchSVInspector, SVInspector
   - May need explicit waits for element rendering
   - Check if components properly mount before test queries

### Phase 3: Build Issues
1. Investigate gfa-to-tabix Rust binary build
2. Verify build process in CI

---

## Debugging Tips

**To run a specific test suite:**
```bash
pnpm test -- products/jbrowse-web/src/tests/CircularView.test.tsx
```

**To update snapshots:**
```bash
pnpm test -- -u
```

**To run with openHandles detection (for resource leaks):**
```bash
pnpm test -- --detectOpenHandles
```

**To run just one test within a file:**
```bash
pnpm test -- -t "test name pattern"
```

---

## Resource Management

The test suite runs 406 test files across 403 total test suites.
- **maxWorkers: 25%** prevents resource exhaustion
- Some tests are slow (e.g., TextSearchingImportForm: 176s, SVInspector: 196s)
- Monitor memory usage during full test suite runs

---

## Important Notes

- Jest tests run in jsdom environment (for DOM tests) and Node environment (for CLI tools)
- Tests use `setupFilesAfterEnv` for fetch mocking (jsdom projects)
- Some tests have 20s timeout - longer tests may occasionally timeout under load
- Worker process exit warnings indicate potential test cleanup issues (leaking timers/resources)

