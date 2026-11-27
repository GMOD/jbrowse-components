---
name: a-typed-url-in-a-tour-is-checked-against-its-page
description: A video tour that types a data URL is held to nothing on the page that prints it, so a rehost moves one copy and the tour films a URL the docs no longer give; widening pastedTrackConfigs to any typed text closes it.
---

# A typed URL in a tour is checked against its page

`pastedTrackConfigs`
([video-specs.ts](../../../website/scripts/video-specs.ts)) pairs a tour with
the page fence it pastes, and `check-paste-configs` holds the two to one text.
Only configs are covered: `video-spec-rules.ts` demands a pair only for a `type`
step whose value starts with `{`, and `check-paste-configs.ts` compares against
`json*` fences only.

The exposure is live: `sv/inspector_route`
([videos/sv.ts](../../../website/scripts/videos/sv.ts)) types the SKBR3 VCF URL
(`svVideoFixtures.callsetUrl`) that
[sv_inspector_view.md](../../../website/docs/user_guides/sv_inspector_view.md)
links, and a rehost would move one and not the other.

## The change

Extend the pair to `{ video, doc, text }`, where `text` is a typed value the
page must contain verbatim, and have `check-paste-configs` search the page's
whole text for such an entry. No new mechanism.
