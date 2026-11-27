---
name: a-same-tab-navigation-drops-the-tour-overlay
description: A video tour step that navigates its own tab loses the drawn cursor and captions while the .vtt still ships every line, and nothing reports it; a `navigates` step that re-injects the overlay, as `opensTab` does, fixes it.
---

# A same-tab navigation drops the tour overlay

`injectOverlay` runs once before the first step
([generate-video.ts](../../../website/scripts/generate-video.ts)); the re-inject
exists only on the `opensTab` branch. Every overlay helper in
[video-overlay.ts](../../../website/scripts/video-overlay.ts) null-guards, so
after a same-tab navigation the clip keeps filming with no cursor and no
captions, while the `.vtt` still ships every line and `video-report.ts` sees
nothing wrong.

This is what keeps a tour from starting on a fresh install with no config: the
banner's only affordance is `<a href="?config=test_data/volvox/config.json">`
([LoaderErrorBanner.tsx](../../../products/jbrowse-web/src/components/LoaderErrorBanner.tsx)),
a same-tab navigation.

## The change

- Add `navigates?: boolean` to `VideoStep`
  ([video-spec-types.ts](../../../website/scripts/video-spec-types.ts)).
- In `generate-video.ts`, mirror the `opensTab` branch for it: wait for the
  navigation, then `injectOverlay`, `setCaption` and park the cursor again.
