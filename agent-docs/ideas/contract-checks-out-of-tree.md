---
name: contract-checks-out-of-tree
description: The display-contract checks are gated in-tree and stripped in production, so the one population they were written for — a plugin author whose display overrides a renamed gate hook — is the one that never sees them. The lint conversions do not shrink this, and the open half is the channel, not the cost.
---

# Reaching an out-of-tree plugin author with a contract check

Moved out of [TODO.md](../TODO.md) on 2026-08-22, where it had stopped being an
action item: the in-tree half is done and what is left is a channel nobody has
designed. Cited from
[reference/ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md)
§"Ordering is the contract".

## What is closed

In-tree the checks are gated. `config/jest/console.js` buffers the
`[jbrowse <family> contract]` prefix and `config/jest/contractGate.js` fails the
test that collected one, so a display in this repo that violates one goes red.

## What is not

Out of tree, nothing catches anything. `process.env.NODE_ENV === 'production'`
no-ops every one of them, so a plugin author whose display overrides a renamed
gate hook gets the unguarded download and no message, ever. That is the
population least able to diagnose it, and the one nobody can write a test for.

**The lint conversions do not change this and do not shrink it.** A selector
reaches an out-of-tree plugin exactly as little as a stripped `console.error`
does, so each contract that moved to `no-restricted-syntax` left this gap
exactly the size it was.

## Why it is an idea and not a task

The question is **channel, not cost** — the checks are a `getMembers` call per
display at attach, which is nothing. But a `console.error` surviving into a
production build reaches nobody either, so unstripping them is not the fix that
looks like it. The version worth building is one a plugin author would actually
see, which means a **session notification behind a developer flag**: something
that surfaces in the app, in the session the broken display is in, without
shouting at every user of a shipped site.

That wants a flag that does not exist, a notification severity that says
"your plugin, not your data", and a decision about whether a site admin can turn
it on in production at all. None of those is a line of code, which is why it
moved here.
