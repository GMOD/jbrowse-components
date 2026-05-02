# Jest Test Commands Reference

**Quick command reference for fixing tests on webgl-poc branch.**

---

## Most Common Commands

### Run a single test file
```bash
pnpm test -- products/jbrowse-web/src/tests/CircularView.test.tsx
```

### Update snapshots for a test
```bash
pnpm test -- products/jbrowse-web/src/tests/CircularView.test.tsx -u
```

### Run one specific test by name
```bash
pnpm test -- products/jbrowse-web/src/tests/CircularView.test.tsx -t "test name pattern"
```

### Run full test suite (slow, ~10 min)
```bash
pnpm test
```

---

## Diagnostic Commands

### See which tests are failing
```bash
pnpm test 2>&1 | grep -E "FAIL|PASS|Tests:" | tail -40
```

### Detect resource leaks (timers, open handles)
```bash
pnpm test -- products/jbrowse-web/src/tests/CircularView.test.tsx --detectOpenHandles
```

### Verbose console output (see all logs)
```bash
pnpm test -- products/jbrowse-web/src/tests/CircularView.test.tsx --verbose
```

### Run multiple test files
```bash
pnpm test -- src/tests/
```

---

## Before Running Tests

### Clear port 3333 if in use
```bash
bash -c 'fuser -k 3333/tcp 2>/dev/null || true; sleep 1'
```

### Kill all Node processes (aggressive)
```bash
pkill -9 node; sleep 2
```

---

## Current Test Suite Stats

Run this to get updated numbers:
```bash
timeout 600 pnpm test 2>&1 | grep -E "Test Suites:|Tests:|Snapshots:" | tail -5
```

Expected output:
```
Test Suites: 28 failed, 3 skipped, 375 passed, 403 of 406 total
Tests:       55 failed, 20 skipped, 6 todo, 3437 passed, 3518 total
Snapshots:   35 failed, 488 passed, 523 total
```

---

## Snapshot Debugging

### View image snapshot differences
```bash
# After running test with failure, check:
ls products/jbrowse-web/src/tests/__image_snapshots__/__diff_output__/
# Open .png files to see visual diffs
```

### View SVG snapshot differences
```bash
pnpm test -- products/jbrowse-web/src/tests/BreakpointSplitView.test.tsx
# Look at the diff output showing before/after XML
```

---

## Common Failure Patterns

### Pattern: "Unable to find element by [data-testid="..."]"
**Means:** The component didn't render in time. Solutions:
- Increase timeout in waitFor()
- Add explicit `await waitFor()`
- Check if async operations are completing

**Command to debug:**
```bash
pnpm test -- products/jbrowse-web/src/tests/CircularView.test.tsx --verbose
```

### Pattern: "X snapshots failed"
**Means:** Output differs from saved snapshot. Solutions:
- Review the diff to see if it's intentional
- Update with `-u` flag if changes are correct
- Investigate if rendering changed unexpectedly

### Pattern: "CLASS is not a constructor"
**Means:** Jest teardown race condition (usually safe to ignore). 
- Test often passes anyway
- Only investigate if test actually fails
- Use `--detectOpenHandles` to find real issues

---

## Finding Tests by Category

### All CircularView tests
```bash
pnpm test -- -t CircularView
```

### All ExportSvg tests
```bash
pnpm test -- -t "export svg"
```

### All Synteny tests
```bash
pnpm test -- -t "synteny"
```

### All tests from a directory
```bash
pnpm test -- products/jbrowse-web/src/tests/
```

---

## When Tests Hang

### Timeout and force exit
```bash
timeout 120 pnpm test -- products/jbrowse-web/src/tests/CircularView.test.tsx
```

### Check running processes
```bash
ps aux | grep -E "node|chrome|jest" | grep -v grep
```

### Kill everything and restart
```bash
pkill -9 node; pkill -9 chrome; sleep 3
```

---

## Performance Tips

### Run tests in parallel (default)
Tests already use `maxWorkers: 25%` in jest.config.js

### Run tests sequentially (slower but cleaner output)
```bash
pnpm test -- --maxWorkers=1 products/jbrowse-web/src/tests/CircularView.test.tsx
```

### Skip slow tests
Slow tests (>100s):
- TextSearchingImportForm: 176s
- SVInspector: 196s

Skip them if in a hurry:
```bash
pnpm test -- --testNamePattern="^(?!.*slow)" 
```

---

## After Making Fixes

### Verify one test passes
```bash
pnpm test -- products/jbrowse-web/src/tests/FixedTest.test.tsx
# Should see: "Tests: 1 passed, 1 total"
```

### Commit your fix
```bash
git add -A
git commit -m "fix: Description of what was fixed

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

### Run full suite to check for regressions
```bash
timeout 600 pnpm test 2>&1 | tail -30
```

---

## Tips for Debugging

### Print debug info in test
```typescript
// Add temporary logging
console.log('Current state:', JSON.stringify(state, null, 2))
const element = getByTestId('some-id')
console.log('Element HTML:', element.outerHTML)
```

### Check rendered DOM in test
```typescript
// After a render, inspect what's actually there
const { debug } = render(<Component />)
debug()  // Prints full DOM
```

### Wait longer for slow operations
```typescript
// Instead of:
await waitFor(() => expect(...).toBe(...), { timeout: 5000 })

// Use longer timeout:
await waitFor(() => expect(...).toBe(...), { timeout: 30000 })
```

