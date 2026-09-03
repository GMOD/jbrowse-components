#!/bin/bash

# Manual production deploy, for when the site should go live without an
# 'update docs' commit on main. Mirrors .github/workflows/update-docs.yml step
# for step — keep the two in sync.
#
#   ./deploy.sh      build, show what the sync would change, confirm, deploy
#   ./deploy.sh -n   build and show only
#   ./deploy.sh -y   no prompt
#
# The prompt comes after the build because that is when the deletions are
# knowable: rclone sync removes whatever dist/ does not carry, and the bucket
# has no versioning.

set -e

SYNC=(rclone --config rclone.conf sync disthash: s3:jbrowse.org/jb2 --checksum --fast-list)

pnpm build

removed=$("${SYNC[@]}" --dry-run 2>&1 | grep 'Skipped delete' | sed 's/.*NOTICE: //' || true)
deletions=$(printf '%s' "$removed" | grep -c . || true)
printf '%s\n' "$removed" | grep -v 'pagefind/' || true

if [ "$1" = "-n" ]; then
  echo "Dry run only: $deletions file(s) would be deleted from s3:jbrowse.org/jb2"
  exit 0
fi

if [ "$1" != "-y" ]; then
  branch=$(git rev-parse --abbrev-ref HEAD)
  unpushed=$(git rev-list --count "@{upstream}..HEAD" 2>/dev/null || echo '?')
  dirty=$(git status --porcelain | wc -l | tr -d ' ')
  echo
  echo "Deploy this tree to https://jbrowse.org/jb2/"
  echo "  branch $branch, $unpushed unpushed commit(s), $dirty uncommitted file(s)"
  echo "  $deletions file(s) deleted from the bucket (pagefind's hashed indexes churn every build)"
  read -r -p "Continue? [y/N] " reply
  [ "$reply" = "y" ] || exit 1
fi

"${SYNC[@]}"

# llms.txt also goes at the domain root, where AI tools look for it
# (llmstxt.org). Its links are absolute /jb2 urls, so the same file works
# verbatim at the apex.
aws s3 cp dist/llms.txt s3://jbrowse.org/llms.txt \
  --region us-east-1 --content-type "text/plain; charset=utf-8"

aws cloudfront create-invalidation --distribution-id E13LGELJOT4GQO --paths "/jb2/*" "/llms.txt"
