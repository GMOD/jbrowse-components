# JBrowse 2 embedded demos

Release tooling for the standalone starter repos under
[github.com/GMOD](https://github.com/GMOD) that show `@jbrowse/react-app2`,
`@jbrowse/react-linear-genome-view2`, and `@jbrowse/react-circular-genome-view2`
wired up in each supported bundler. They are what
[the embedded components page](https://jbrowse.org/jb2/docs/embedded_components/)
links to, and what most people copy when starting an embed, so they need to be
rebuilt against each release.

## Release pass

After the `@jbrowse` packages are published to npm:

```bash
./update_all.sh
```

That runs, in order:

1. `clone_demos.sh` — clone any repo not yet in `$JB2TMP` (default `~/jb2tmp`)
2. `update_demos.sh` — `git pull` and `yarn upgrade` each one onto the new
   published versions
3. `copy_files.sh` — stamp the canonical configs from `base/` into each checkout
4. `build_demos.sh` — build everything, so a breakage surfaces before anything
   ships
5. `deploy_demos.sh` — `yarn deploy` each one to `jbrowse.org/demos/...`
6. `push_demos.sh` — commit and push the resulting lockfile/config changes

Each step is also runnable on its own and is safe to re-run.

`update_demos.sh` refuses to run against a checkout with uncommitted changes
rather than stashing them, so if it stops on a dirty repo, resolve that repo by
hand and re-run.

## Adding or removing a demo

`demos.sh` is the single source of truth: one line per repo, giving the config
to install and the directory that bundler expects it in. Every other script
iterates it.

Keep it in sync with the table in `website/docs/embedded_components.md`. The two
drifted apart once already (the farm-fe demos were pulled from the docs but kept
getting built and deployed for releases afterward), which costs release time on
demos nobody can find.

## Configs

`base/{linear,circular,app}/config.ts` are the assemblies, tracks, and default
sessions every demo of that component shares, so all the bundler variants show
the same thing and only differ in build setup. Edit them here, never in the
individual demo repos, or the next `copy_files.sh` will overwrite the change.
