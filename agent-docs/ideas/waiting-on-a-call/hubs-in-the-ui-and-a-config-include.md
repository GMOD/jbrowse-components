---
name: hubs-in-the-ui-and-a-config-include
description: Three calls for Colin on connections, carried over from the closed connection handoff: call them track hubs in the menus, add a config `include` for splitting config.json, and make the add form one URL field.
---

# Hubs in the UI, and a config include

Moved here on 2026-11-20 when the connection handoff closed. What a hub saves,
which copy of its track wins and how the track is named are in
[ADR-280](../../architecture-decision-records/adr-280-a-hub-is-a-pointer-plus-the-tracks-a-user-touched.md),
along with the bugs left open.

## The word in the UI

The menus read "Open connection...", "Add connection..." and "Delete
connection...". The proposal is "Add track hub..." and "Remove hub...", with
`connections` staying as the config key.

## A config include

An `include` for splitting `config.json` across files, merged at startup, with
connections kept for hubs loaded on demand. The admin server would have to save
edits without copying included tracks into `config.json`. ADR-280 declines
loading a JBrowse 2 hub this way, since the Hubs plugin adds a hub on demand,
which a startup include cannot do; an include for a site's own files is a
separate question.

## The add form

One URL field that reads the hub before saving, takes the type and name from
it, and identifies the hub by its URL. It waits on the word above, since the
form's labels and title use it.
