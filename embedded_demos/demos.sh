#!/bin/bash
# Single source of truth for the embedded-component demo repos.
#
# Each entry is "<repo> <config-source> <config-dest-dir>", where the dest dir is
# relative to the repo root and is where that bundler expects app source to live.
# Every other script in this directory iterates DEMOS, so adding a demo repo here
# is the only edit needed.
#
# Keep this list in sync with the table in website/docs/embedded_components.md,
# which is what users actually see.

DEMOS=(
  # linear genome view
  "jbrowse-react-linear-genome-view-vite-demo      base/linear/config.ts    src"
  "jbrowse-react-linear-genome-view-rsbuild-demo   base/linear/config.ts    src"
  "jbrowse-react-linear-genome-view-nextjs-demo    base/linear/config.ts    app"
  "jbrowse-react-linear-genome-view-vanillajs-demo base/linear/config.ts    ."

  # circular genome view
  "jbrowse-react-circular-genome-view-nextjs-demo    base/circular/config.ts  app"
  "jbrowse-react-circular-genome-view-vanillajs-demo base/circular/config.ts  ."

  # full react app
  "jbrowse-react-app-vite-demo      base/app/config.ts  src"
  "jbrowse-react-app-rsbuild-demo   base/app/config.ts  src"
  "jbrowse-react-app-nextjs-demo    base/app/config.ts  app"
  "jbrowse-react-app-vanillajs-demo base/app/config.ts  ."
)

# The farm-fe demos (jbrowse-react-{linear-genome-view,app}-farm-demo) were
# dropped from embedded_components.md in 1659ab7656 for unresolved breakages,
# but stayed in these scripts, so every release kept building and deploying two
# demos nobody links to. They are out of DEMOS deliberately. Re-add them here if
# and only if they go back into the docs table.

JB2TMP=${JB2TMP:-~/jb2tmp}

# run a command in each demo checkout. usage: for_each_demo <fn>, where <fn> is
# called with the repo name and runs inside that repo
for_each_demo() {
  local fn=$1
  local entry repo
  for entry in "${DEMOS[@]}"; do
    read -r repo _ _ <<<"$entry"
    if [ ! -d "$JB2TMP/$repo" ]; then
      echo "SKIP $repo (not cloned, run ./clone_demos.sh)"
      continue
    fi
    (cd "$JB2TMP/$repo" && "$fn" "$repo")
  done
}
