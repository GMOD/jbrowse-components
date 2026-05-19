#!/bin/bash
# Check documentation links for common issues

set -e

DOCS_DIR="docs"
ISSUES=0

echo "🔍 Checking documentation links..."
echo ""

# Check for relative paths (exclude auto-generated docs)
echo "Checking for relative path links (../) in user docs..."
RELATIVE_LINKS=$(find "$DOCS_DIR" -maxdepth 2 -name "*.md" -type f \
  ! -path "*/config/*" ! -path "*/models/*" ! -path "*/node_modules/*" \
  -exec grep -l "](\.\./" {} \; 2>/dev/null || true)

if [ -n "$RELATIVE_LINKS" ]; then
  echo "❌ Found relative path links! Use /docs/... instead:"
  echo "$RELATIVE_LINKS" | while read f; do
    grep "](\.\./" "$f" | sed "s/^/  /"
  done
  ISSUES=$((ISSUES + 1))
else
  echo "✓ No relative path links found in user docs"
fi

echo ""

# Check for trailing slashes in /docs/ links
echo "Checking for trailing slashes in /docs/ links..."
if grep -r "](/docs/.*/$" "$DOCS_DIR" --include="*.md" 2>/dev/null; then
  echo "❌ Found trailing slashes in /docs/ links! Remove trailing slash"
  ISSUES=$((ISSUES + 1))
else
  echo "✓ No trailing slashes found"
fi

echo ""

# Check for filename/ID mismatches (basic check)
echo "Checking for filename/ID mismatches..."
MISMATCHES=$(find "$DOCS_DIR" -maxdepth 2 -name "*.md" -type f ! -path "*/node_modules/*" ! -path "*/config/*" ! -path "*/models/*" -exec sh -c '
  f="$1"
  filename=$(basename "$f" .md)
  docid=$(grep "^id:" "$f" 2>/dev/null | head -1 | sed "s/^id: //" | tr -d " ")
  if [ -n "$docid" ] && [ "$filename" != "$docid" ]; then
    echo "$f"
  fi
' _ {} \; | wc -l)

if [ "$MISMATCHES" -gt 0 ]; then
  echo "❌ Found $MISMATCHES filename/ID mismatches:"
  find "$DOCS_DIR" -maxdepth 2 -name "*.md" -type f ! -path "*/node_modules/*" ! -path "*/config/*" ! -path "*/models/*" -exec sh -c '
    f="$1"
    filename=$(basename "$f" .md)
    docid=$(grep "^id:" "$f" 2>/dev/null | head -1 | sed "s/^id: //" | tr -d " ")
    if [ -n "$docid" ] && [ "$filename" != "$docid" ]; then
      echo "  - $f: filename=$filename, id=$docid"
    fi
  ' _ {} \;
  ISSUES=$((ISSUES + 1))
else
  echo "✓ All filenames match their doc IDs"
fi

echo ""

if [ "$ISSUES" -gt 0 ]; then
  echo "❌ Found $ISSUES issue(s). Please fix before committing."
  echo ""
  echo "For help, see: website/DOCS_GUIDE.md"
  exit 1
else
  echo "✅ All documentation links look good!"
  exit 0
fi
