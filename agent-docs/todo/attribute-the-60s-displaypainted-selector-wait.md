---
name: attribute-the-60s-displaypainted-selector-wait
description: the census shipped; wrap the two selector waits that throw before it runs
metadata:
  area: browser tests
  category: ready
---

# Attribute the 60s `displayPainted` selector wait

The other failure mode next to blank captures: a display never satisfies
`displayPainted` inside 60 s — the readiness attribute, not a mutating test id,
since `b7f076fe04` deleted the `-done` suffix wholesale and made it
`data-display-drawn` (ADR-065).

**The census this asked for shipped.** `23d6fda584` added
`pendingDisplayStates` / `describePendingDisplays`
(`products/jbrowse-capture/src/sessionGate.ts:284-341`, tested in
`pendingDisplays.test.ts`), which `snapshot.ts:271` consumes — re-reading the DOM
at report time rather than off a held handle, exactly as this asked — so a wait
that expires names each unpainted display and its own `data-display-phase`.

**What is left is the wait that runs first.** `canvasSnapshot`
(`products/jbrowse-web/browser-tests/snapshot.ts:479-489`) opens on a bare
`page.waitForSelector(selector, { timeout: 60000 })` and throws puppeteer's
opaque `TimeoutError` before `waitForCaptureSettled` — and so before that census
— runs at all; `helpers.ts:47-77` is the same shape at a 30 s default. Those two
sites are the work: catch the timeout, run the census that now exists, re-throw
with it. `waits.ts` already notes the shape it will report
(`products/jbrowse-capture/src/waits.ts:163-165,199-206`): a display in a
terminal `tooLarge`/`renderError` state renders no wrapper and so can never
report painted, which reads as a timeout forever.

An earlier attempt was reverted (`839113dabe`) — re-query the selector per
attempt rather than holding the handle, and prove the mechanism on a targeted
reproduction first.
