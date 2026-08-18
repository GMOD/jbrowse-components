---
name: web-export-uncarried-state
description: Three things desktop's "export to web" can only report, not carry — a track delta it cannot tell from hub drift, an assembly edit, an internet account. Read before adding a carrier or a pristine-base snapshot.
---

# What the web export can report but not carry

`planWebExport` reports each of these to the sender (see `WebExportPlan`'s
`revertedAssemblies` and `unavailableAccounts`, and the comment on
`splitTracksAgainstBase`). Reporting was the cheap half. Carrying needs new state
on one side or the other, and each has a reason it was not taken now.

## 1. A hub track's delta cannot be told from hub drift

Under `hostedConfigBase` an edited hub track ships as a `trackConfigDeltas`
entry, diffed against the hub config **fetched at export time**. Desktop's own
copy is the hub as it was **when the session was created** — desktop persists the
whole config and edits `jbrowse.tracks` in place. So a track the hub itself
changed in between diffs as though the sender had edited it, and the recipient
gets a delta pinning them to the sender's older values.

That outcome is the export's stated intent — reproduce the sender's screen, the
same reason `bakeSessionCascades` exists — so it is not simply wrong. What is
wrong is the channel: a `trackConfigDeltas` entry means "this user overrode the
admin config" on the far side, so it shows an edited badge, offers Reset, and
masks every later admin change to that track.

The oracle is the base as it was at session creation, which nothing persists.
Cheapest shape that would work: record a per-track digest of the pristine config
at `fetchConfig` time (a hash per track, tens of KB for a 1000-track hub) and
ship a delta only for a track whose digest no longer matches. Tracks saved before
that exists have no digest, so the fallback is today's behaviour, which is what
makes it addable without a migration.

## 2. An assembly edit does not travel

`coveredByBase` matches assemblies by name, and nothing ships an assembly delta —
a user who attaches a refNameAlias or cytoband file to a hub assembly exports a
session that uses the hub's original. `withoutBaseAssemblies` also drops a
session assembly whose name collides with a base one, which it has to: the two
lists are concatenated into one namespace on the far side and a duplicate makes
every assembly's `configuration` safeReference ambiguous, taking the session down
on the next read.

Carrying it needs either an assembly-level delta channel (the shape
`trackConfigDeltas` already has for tracks) or a merge rule on the far side that
resolves the collision instead of refusing it. Both are jbrowse-web changes, and
the second is the one that also fixes a plain shared session.

## 3. Internet accounts have no session carrier

`internetAccounts` live in the root config alone; `sessionInternetAccounts` does
not exist. A hosted-base export therefore carries exactly the accounts the base
config declares, and a self-contained export (`?config=none`) carries none —
`unavailableAccounts` names the ones a shipped file will ask for and not find.
The recipient does not crash (`findAppropriateInternetAccount` returns null for
an unknown type rather than pushing it into the union); the file goes out
unauthenticated and 401s.

Plugins and connections both got session-level carriers for exactly this reason,
so the symmetric move is obvious — and it is the one to be slow about. An account
config is a client id, a set of domains and a token endpoint, and auto-shipping
one turns "share my session" into "hand someone else my organisation's auth
configuration". If it lands it wants to be a choice at export time, listed like
the upload consent for a short link, not a silent carrier.
