---
name: adr-232-config-predicates-and-bands
description: ADR-232 settles where every display's predicates, bands, guides and plot words live, and renames slots on nine display types. The 5.0.0 tag freezes config slot paths (ADR-120), after which each rename costs a `retired` entry kept for good, so the order of work lands before the tag.
metadata:
  area: config
  category: ready
  order: 1
  first_move: "step 5 of ADR-232's order of work (steps 1 to 4 are built): the sashimi fallback, junction extraction and motifs under a derived `coverage.show || sashimi.show`, with the LGVSynteny `sashimi.show` default"
---

# ADR-232's config renames land before 5.0.0

[ADR-232](../architecture-decision-records/adr-232-a-predicate-lives-where-what-it-selects-lives.md)
states the decision and a nine-step order of work, each step a commit or
more of its own. Its Consequences list the silent failures each step sweeps
for, chiefly a stale `getConf(self, 'oldName')`, which compiles and reads
`undefined`.

External writers move in step: ggjbrowse (the tables engine's `settings`, its
docs and tutorials), jb2hubs (`showVariantLane` in the pangenome configs and
share links, `filter: [...]` on the ALFA track) and the graph plugin (plot
words). JBrowseR and jbrowse-anywidget need only a rebuild.
