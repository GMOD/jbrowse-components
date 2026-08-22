---
name: web-export-uncarried-state
description: Four things desktop's "export to web" can only report, not carry — a track delta it cannot tell from hub drift, an assembly edit, an internet account, and the deployment version the link opens against. Read before adding a carrier or a pristine-base snapshot.
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
The cheapest shape that would work: digest each track of the **hydrated** config
once, right after the root model is built from a fetched hub, and store the map
in a desktop-only config slot; at export, ship a delta only where the digest no
longer matches. Digest the hydrated snapshot rather than the raw JSON, or every
track reads as edited — `stripDefault` drops an explicitly-authored default from
the snapshot and the raw file still has it. A session saved before the slot
exists has no digests and falls back to today's behaviour, so no migration.

**Do not reach for that without deciding the question under it, which is not a
bug so much as a choice about what a link means.** Both behaviours are wrong in
one direction:

| hub drift since the session was made | today (ship the delta) | with the oracle (ship nothing) |
| --- | --- | --- |
| the hub **fixed** a broken adapter url | recipient gets the broken url, with an edited badge and a Reset that repairs it | recipient gets the working url |
| the hub **changed** a color the sender is looking at | recipient sees what the sender saw | recipient silently sees a different color from the one the sender sent them to look at |

So the oracle buys the first row and sells the second, and the two failures are
not equally visible: today's is announced on the track and one click from being
undone, while the oracle's is silent on both ends. A smaller link and admin fixes
flowing through are real gains; a "look at this" link quietly showing something
else is a real loss. Take this on when someone decides which of those the export
is for — and if the answer is the oracle, the badge is worth suppressing for a
delta the sender never authored, since that is the visible half of what makes
today's behaviour tolerable.

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

## 4. The export does not pin the deployment it opens

Moved out of [TODO.md](../TODO.md) on 2026-08-22, where it was an action item
for a decision that is not a code one.

`DEFAULT_WEB_BASE_URL` is `.../jb2/latest/`, and the hosted base config a link
diffs against is fetched fresh on **both** ends — so an export made today opens
against whatever is deployed when someone follows it. This is §1's hub drift one
step later in the link's life: §1 is the base moving between session creation
and export, this is the base moving between export and open.

The diagnosis half is closed. The link records what produced it —
`exportedFrom=jbrowse-desktop@<version>` — so a recipient whose view does not
match the sender's can at least be told which desktop built it.

What is open is whether the link should also pin what it *opens*, and that is a
deployment decision rather than a code one: pinning means every exported link
holds a versioned deployment alive indefinitely, and `latest/` exists precisely
so that a fix reaches every link ever sent. Whoever decides it is deciding how
long jbrowse.org keeps old builds, not how `planWebExport` is written.
