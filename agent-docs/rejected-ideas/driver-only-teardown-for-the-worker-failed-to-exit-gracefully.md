---
name: driver-only-teardown-for-the-worker-failed-to-exit-gracefully
description: Driver-only teardown for the "worker failed to exit gracefully" warning
area: tooling-tests-and-docs
---

# Driver-only teardown for the "worker failed to exit gracefully" warning

—
does nothing. Needs a full MST destroy in `tests/util.tsx`, and full teardown
breaks ~13 suites.
