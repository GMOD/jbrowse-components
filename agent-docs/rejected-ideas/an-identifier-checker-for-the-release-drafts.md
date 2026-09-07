---
name: an-identifier-checker-for-the-release-drafts
description: An identifier checker for the release drafts
area: tooling-tests-and-docs
---

# An identifier checker for the release drafts

built, run, and declined as
overkill for what it buys. It extracted every flag, backticked name and
CamelCase symbol from `website/release_announcement_drafts/` and failed any
that appeared nowhere in the source, catching the v5.0.0 draft's
already-reverted `jbrowse transitive-paf` and its renamed `StatusChip`. Two
things it needed are the reason not to keep it. Names that are absent ON
PURPOSE are the whole point of a breaking-changes section, so it needed an
`<!-- absent-ok: … -->` directive listing eight of them, which a human curates
and which drifts. And it had to exclude its own file from the corpus, since
the removed symbols named in its explanatory comments were otherwise evidence
that those symbols still existed — `CoreRender` passed on that alone. The
first version also missed `jbrowse transitive-paf`, the case it was written
for, because a backticked run with a space in it is not one identifier; the
fix was to tokenize inside backticks. A checker whose heuristics need that
much repair is a maintenance burden with false confidence attached. The
remedy in PUBLISHING.md is to have an agent read the draft against the source
before publishing, which needs no allowlist because it can tell "removed, and
the draft says so" from "stale" by reading.
