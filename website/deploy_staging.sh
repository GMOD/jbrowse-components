#!/bin/bash

# `rclone sync` DELETES what the source does not carry, so a failed build must
# stop the script rather than hand it an absent dist/. Without this the run
# still exits 0, because the last command is the invalidation: a build that
# died on a docs gate reads as a successful deploy. What saved it the one time
# this happened was rclone refusing to delete after an IO error, which is a
# safety net rather than a plan.
set -euo pipefail

SITE_BASE_PATH=/jb2-staging JBROWSE_CODE_BASE=https://jbrowse.org/code/jb2/main/ pnpm build
rclone --config rclone.conf sync disthash: s3:jbrowse.org/jb2-staging --checksum --fast-list
aws cloudfront create-invalidation --distribution-id E13LGELJOT4GQO --paths "/jb2-staging/*"
