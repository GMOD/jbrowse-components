---
name: start-the-fetch-before-react-renders-the-display
description: "On a cold alignments load the render request leaves ~117 ms of diffuse main-thread work after the assembly's .2bit read, much of it React's first render of the track and the display's layout getters. Check whether the fetch autorun can run before React renders the display instead of after it."
---

# Start the fetch before React renders the display

[COLD_LOAD_PROFILE.md](../../reference/COLD_LOAD_PROFILE.md) §"Where a small
load goes" shows the header reads no longer wait on their index, so the longest
chain is now the assembly's `.2bit` read followed by ~117 ms of main-thread work
before the render request goes out: `launchTrackGeneric` 21 ms inclusive, forced
layout in `useScrollPortOverflow` and `useChromeHeightVar` ~14 ms, the
alignments display's layout getters (`sections`, `lanes`, `scrollContentHeight`)
and React's first render of the track.

**First move:** find what the fetch autorun reads and whether it can fire once the
assembly and region resolve, without waiting for the display to mount. Measure
with `probe-coldload-phases.ts` over the same window; at 80 ms RTT the gain is
bounded by the 117 ms, and it shows only where the second chain binds.
