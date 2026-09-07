---
name: consolidating-the-three-implementations-of-has-jbrowse-finished-rendering
description: Consolidating the three implementations of "has JBrowse finished rendering"
area: tooling-tests-and-docs
---

# Consolidating the three implementations of "has JBrowse finished rendering"

proposed 2026-09-01 after `jb.waitReady` made a third, and
declined. The logic cannot be shared: capture serializes its in-page readers
through `page.evaluate`, so each can only call what it declares inside itself,
and it is a published CLI whose one runtime dependency is puppeteer. The
contract is shared and now pinned by `scripts/readinessContract.test.ts`.
Reasoning, and the table of what deliberately differs, in
[ADR-101](../architecture-decision-records/adr-101-readiness-is-answered-three-times-on-purpose.md).
