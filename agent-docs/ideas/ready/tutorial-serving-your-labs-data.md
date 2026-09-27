---
name: tutorial-serving-your-labs-data
description: A tutorial that walks static hosting (S3, GitHub Pages, nginx), CORS and range requests, where jbrowse create output goes, and data behind a login, ending at a URL a collaborator can open. Colin's named priority from the 2026-07 audit; today the material is scattered FAQ entries plus deploying.md and authentication.md.
---

# Tutorial: serving your lab's data

Split out of the tutorial-ideas audit on 2026-09-27. Colin called it out on
2026-07-26 as the boring-but-high-value one.

Static hosting (S3, GitHub Pages, plain nginx), CORS and range requests, where
`jbrowse create` output goes, and putting data behind a login. All of this
exists today only as scattered FAQ entries ("How can I setup JBrowse 2 on my web
server", "Should I configure gzip on my web server", "BAM (or other indexed
binary files) do not work on my server", "How do I put my data behind a login",
"Why do I get a CORS error when loading remote files") plus
`config_guides/deploying.md` and `config_guides/authentication.md`. The tutorial
is the walkthrough that turns those into one path, ending at a URL a
collaborator can open. Reuse `quickstart_web.md` for file prep rather than
restating bgzip/tabix.

Low support counts on hosting and CORS
([TUTORIAL_DEMAND.md](../../reference/TUTORIAL_DEMAND.md)) are not evidence of
low value: those questions have FAQ entries that rank in search, and someone who
finds the answer never files.

The genome-portal operator — hundreds or thousands of tracks, categories and
metadata for the faceted selector, hubs and connections — is the same audience
one tier up in scale, and genomes.jbrowse.org and jb2hubs are the existence
proofs; the docs teach none of it.
