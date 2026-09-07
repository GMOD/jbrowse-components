---
name: a-comparative-genomics-chooser-on-the-tutorials-page
description: A comparative-genomics chooser on the tutorials page
area: tooling-tests-and-docs
---

# A comparative-genomics chooser on the tutorials page

declined by Colin,
2026-08-09: "overly complicated, they will just have to read the titles." The
entry argued that the ten synteny and pangenome cards have interchangeable
ribbon-stack thumbnails, so a reader holding a PAF cannot tell which page is
theirs, and proposed a decision page routing on what you have. The premise was
wrong: it reasoned from the thumbnails and skipped the line underneath them.
Those titles already name the input or the tool — "(pairwise minimap2)",
"(all-vs-all minimap2)", "Synteny from an ortholog table", "Synteny from
MCScan anchors", "Pangenome (pggb)" — which is the same key the chooser would
have routed on.
**The general form, worth remembering before proposing the next router:** when
a navigation aid's routing key is already in the labels a reader is looking
at, the aid adds a surface rather than an answer. Fix the titles that do not
carry it instead.
