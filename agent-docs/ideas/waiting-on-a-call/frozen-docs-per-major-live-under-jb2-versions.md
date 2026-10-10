---
name: frozen-docs-per-major-live-under-jb2-versions
description: Live /jb2/docs/ deploys from main, so a user on v4.x reads v5-beta docs for config keys and plugin APIs their version lacks. Freeze each outgoing major's last tag under /jb2/versions/vN.x/, shield it from the deploy's rclone sync-delete with a filter, and link it from /jb2/versions/. Waits on the URL spelling and a few defaults.
---

# Frozen docs per major live under /jb2/versions/

`update-docs.yml` and `website/deploy.sh` build `main` and
`rclone sync … s3:jbrowse.org/jb2`, so `/jb2/docs/` shows v5-beta content while
`/jb2/download/` and `code/jb2/latest/` still serve 4.3.0. A v4 user reads docs
for config keys, display types and plugin hooks their version does not have.
v5 breaks those on purpose and ships no shims, so the gap widens at 5.0.0.

## Design

One docs line per **major**. `/jb2/` stays the current major. Each outgoing
major freezes at its last stable tag. Minors and patches get no copy:
`v4.0.0`→`v4.3.0` changes 174 doc files, `v4.3.0`→`main` changes 591, and only
`v4.3.0` is an Astro site (`v4.0.0`–`v4.2.1` are Docusaurus).

**URLs**, in the shape of Node's `docs/latest-v20.x/` and Python's `/3.12/`:

- index: `https://jbrowse.org/jb2/versions/`
- v4 home: `https://jbrowse.org/jb2/versions/v4.x/`
- a docs page: `https://jbrowse.org/jb2/versions/v4.x/docs/config_guides/assemblies/`

`v4.x` names the line, so a 4.3.1 re-archive keeps the URL and v5 later adds
`versions/v5.x/` without renaming anything. The banner names the exact last
release. A subdomain (`v4.jbrowse.org`) reads best but costs a certificate, a
CloudFront distribution and a host-routing function per major, and the `v4.3.0`
tag hardcodes `/jb2`, so it is not worth one archive.

**Protect the archive from the main sync.** The sync deletes whatever `dist/`
lacks, and the bucket has no versioning. Put one filter in
`website/rclone-filter.txt` and pass `--filter-from` in both `deploy.sh` and
`update-docs.yml`:

```
- /versions/v[0-9]*.x/**
```

Exclude only the frozen builds, never `/versions/**`: rclone skips an excluded
path in both directions, so a blanket exclude would stop `versions/index.html`
(built by main) from uploading. The reviewer tested the sibling glob
`/v[0-9]*/**` on rclone 1.60.1 (the `apt` version CI gets): it kept `v4/` and
`v10/`, still synced `videos/`, and deleted a non-matching `vtest/`. The exact
glob above is untested, so check it with a dry run against a fake tree first.
A branch running an old `deploy.sh` without the filter still wipes the archive,
so keep the archive workflow re-runnable.

**Archive mode** — a `SITE_ARCHIVE` env var in `website/src`:

- `<meta name="robots" content="noindex,follow">` and **no** canonical. Noindex
  plus a canonical to the current page sends conflicting signals, and 310 docs
  at `v4.3.0` against 470 on main means many have no current twin. `main`'s
  `BaseLayout.astro` emits a self-canonical that archive mode must turn off.
- analytics off (`BaseLayout.astro` enables them only when the base is exactly
  `/jb2`, so a different base already gets none).
- a banner: "JBrowse 4.x docs, last release 4.3.0 · current docs → · other
  versions →", the last linking to `/jb2/versions/`.

`robots.txt` cannot help: crawlers read it only at the host root, and
`jbrowse.org/robots.txt` is a 404.

**`/jb2/versions/`** is a small page generated from a `docsVersions` list in
`website/src/lib/`: one row per line with status, last release and a docs link.
The current site gets a sidebar link to it and a "Docs for 5.x ▾" control whose
menu links to that page. It lists nothing itself, so a frozen copy's control
never goes stale when v6 arrives. An interim banner on current docs says
"JBrowse 5 beta docs; on 4.x? →".

**Build from a branch, not the tag.** `v4.3.0`'s `astro.config.mjs` hardcodes
`const BASE = '/jb2'`; `SITE_BASE_PATH` arrived in `d602ec0eb8`. Cut `docs-4.x`
from `v4.3.0` with:

- the three-line base patch (read `SITE_BASE_PATH`);
- `/jb2/…` stripped from `gallery.md` and `demos.md`, whose root-relative links
  double up through `fix-absolute-links` (`/jb2/v4.x/jb2/gallery/` and four more)
  and whose 12 gallery images load from the current site;
- `code/jb2/latest/` (50 links) and `code/jb2/main/` (39) rewritten to
  `code/jb2/v4.3.0/`, since both serve v5 after the release. The 14 configs those
  links name all load on `v4.3.0`; whether the sessions render is unchecked;
- archive mode backported.

Measured 2026-10-10 with `SITE_BASE_PATH=/jb2/v4` after the patch: 43 s, exit 0,
41 MB, 1138 files, 443 pages, all 150 image references resolve (figures are
tracked in git at that tag), pagefind search works under the prefix. The download
page pins `currentVersion` 4.3.0 and the plugin store reads the committed
`plugins.json`, so both freeze correctly.

**`archive-docs.yml`**, `workflow_dispatch` with `ref` and `prefix`: refuse a
prefix the filter would not protect, install with the website filter, build,
`rclone sync dist s3:jbrowse.org/jb2/versions/<prefix>`, invalidate
`/jb2/versions/<prefix>/*` (CloudFront has already cached a 404 for the unused
prefix), then curl the home, a docs page, search and `pagefind/pagefind.js` for
200.

**A weekly probe** of `/jb2/versions/v4.x/docs/` and its `pagefind.js`. Add it
beside `links.yml`'s checks rather than extending its crawl: that workflow
probes URLs written in source, not the hosted site.

**Keep every major's schema.** `/jb2/schema/v5/config.json` is written into user
configs as `$schema`, and the sync deletes it once a later site stops shipping
it. `static/schema/` keeps every major's file permanently.

## First move

Land the filter file and the `deploy.sh` / `update-docs.yml` change, run one
deploy, and only then run the archive workflow. The order matters: the first
deploy after an archive upload without the filter deletes it.

## Calls

Each has a default; confirm or overrule.

- **URL spelling.** Default `/jb2/versions/v4.x/`. Alternatives: `/jb2/versions/4.x/`.
- **Archive v4 now**, ahead of 5.0.0, since the live docs already mismatch.
  Default yes.
- **Blog in archives.** Default keep. Dropping `blog/` and `rss.xml` saves 4.3 MB
  and most of the absolute `https://jbrowse.org/jb2/docs/…` links (145 in the
  `v4.3.0` output, nearly all in posts).
- **Analytics in archives.** Default off.
- **noindex on `/jb2-staging/`.** Default yes; it is an indexable duplicate with
  a self-canonical today.
- **Test data in release builds before 5.0.0.** `website/src/lib/code-base.ts`
  records that release builds lack much of the docs' test data (20 of 38 configs
  404 on `v4.3.0`). A future `v5.x` archive repoints `JBROWSE_CODE_BASE` at the
  release, so decide whether to ship that data or accept partly dead demo links.

## Not doing

- **v1–v3.** `v3.7.0` builds only with three workarounds (yarn on the PATH, a
  supplied `plugins.json` because its prebuild fetches the live store, one blog
  link fix); v1 and v2 were not tried. The v3.0.0 release post calls its
  breaking changes small, so 4.x docs serve those users. Inferred, not compared.
- **A frozen copy per minor.** It would mean running two generators for
  `v4.0.0`–`v4.2.1`.
- **A dropdown listing versions inside a frozen build.** It goes stale.

## Later

Every in-app docs link is unversioned: the Help widget, config links in
`BaseDisplayModel.tsx`, the Jexl and consensus dialogs, the linear genome view
model, Desktop's `window.ts` and `launchMode.ts`. Shipped v4 apps cannot change,
so only the banner on current docs reaches them. From v5, route those links
through one helper that appends `?v=<version>`, and have the docs layout show
"you're on 5.x, these are the 4.x docs" when the major differs. S3 ignores the
query string.

Hosting layout: [HOSTING.md](../../reference/HOSTING.md).
