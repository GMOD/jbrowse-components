# examples-site

Shared rules for all four sites:
[agent-docs/reference/EXAMPLES_SITES.md](../../../agent-docs/reference/EXAMPLES_SITES.md).

**This site reserves no demo heights, and shouldn't.** `demoFillHeight` fixes
every demo box at `80vh` in CSS, so nothing shifts on load, and
`checkDemoHeights` skips a `.fill` box for that reason.
