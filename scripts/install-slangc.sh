#!/usr/bin/env bash
# Downloads a pinned slangc release into .cache/slangc/ (gitignored).
# Run once when you first need to regenerate shaders via `pnpm gen:shaders`.
# Generated *.generated.ts files are committed so `pnpm install` / `pnpm test`
# don't need slangc — only contributors editing `.slang` sources do.
set -euo pipefail

SLANG_VERSION="v2026.5.2"
CACHE_DIR="$(cd "$(dirname "$0")/.." && pwd)/.cache/slangc"
BIN_PATH="$CACHE_DIR/bin/slangc"

if [ -x "$BIN_PATH" ]; then
  INSTALLED_VERSION="$("$BIN_PATH" -v 2>&1 | head -1)"
  if [ "$INSTALLED_VERSION" = "${SLANG_VERSION#v}" ]; then
    echo "slangc $SLANG_VERSION already installed at $BIN_PATH"
    exit 0
  fi
fi

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64)   ASSET="slang-${SLANG_VERSION#v}-linux-x86_64.tar.gz" ;;
  Linux-aarch64)  ASSET="slang-${SLANG_VERSION#v}-linux-aarch64.tar.gz" ;;
  Darwin-arm64)   ASSET="slang-${SLANG_VERSION#v}-macos-aarch64.tar.gz" ;;
  Darwin-x86_64)  ASSET="slang-${SLANG_VERSION#v}-macos-x86_64.tar.gz" ;;
  *) echo "Unsupported platform: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac

mkdir -p "$CACHE_DIR"
echo "Downloading $ASSET to $CACHE_DIR..."
if command -v gh >/dev/null 2>&1; then
  gh release download "$SLANG_VERSION" --repo shader-slang/slang --pattern "$ASSET" --dir "$CACHE_DIR" --clobber
else
  curl -L -o "$CACHE_DIR/$ASSET" "https://github.com/shader-slang/slang/releases/download/$SLANG_VERSION/$ASSET"
fi
tar xzf "$CACHE_DIR/$ASSET" -C "$CACHE_DIR"
rm "$CACHE_DIR/$ASSET"

if [ ! -x "$BIN_PATH" ]; then
  echo "Install failed — slangc not found at $BIN_PATH" >&2
  exit 1
fi

echo "slangc $SLANG_VERSION installed at $BIN_PATH"
