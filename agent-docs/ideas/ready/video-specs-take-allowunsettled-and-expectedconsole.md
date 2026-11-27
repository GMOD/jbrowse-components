---
name: video-specs-take-allowunsettled-and-expectedconsole
description: A screenshot spec can opt out of the settled-app gate and declare the console errors it expects, but a video spec cannot, so a tour that starts with no config or films an error state has no way through the harness.
---

# Video specs take `allowUnsettled` and `expectedConsole`

`ScreenshotSpec` has both fields (`screenshot-asserts.ts` reads
`allowUnsettled`); `VideoSpec`
([video-spec-types.ts](../../../website/scripts/video-spec-types.ts)) has
neither. A tour opening on no config, or on an app showing an error it means
to film, needs both.

## The change

- Add both fields to `VideoSpec` with the screenshot spec's meanings.
- Have `generate-video.ts` honour them at the same gates the screenshot harness
  does.
