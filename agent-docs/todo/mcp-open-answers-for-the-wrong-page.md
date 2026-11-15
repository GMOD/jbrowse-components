---
name: mcp-open-answers-for-the-wrong-page
description: Desktop's MCP `open` takes any page announcement after the call as the new session, so on a cold start the start screen's announcement answers "fell back to the start screen" while the target is still loading. Untested; every `open` test announces first.
metadata:
  area: desktop-mcp
  category: ready
  order: 2
  first_move: "write the failing test in `bridge.test.ts`: call `open` before any page announced, then announce a start screen, and expect the wait to continue"
---

# MCP `open` answers for the wrong page

`openAndWait` (`products/jbrowse-desktop/electron/mcp/bridge.ts`) records
`before = listening?.install` and then accepts the first announcement whose
install differs. With no page listening yet `before` is `undefined`, so during
a cold start, or while an earlier navigation is in flight, the first page's
`startScreen` announcement answers "fell back to the start screen" while the
target is still loading, and a `session` announcement reports the previous
session as the new one.

## The fix

A nonce carried through `openTarget`'s launch and echoed back in
`McpReadyState`, so `openAndWait` waits for the announcement of the load it
started.

## Done when

The test above passes, and an `open` issued right after the app launched
answers with the target's session.
