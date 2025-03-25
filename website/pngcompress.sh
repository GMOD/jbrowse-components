#!/bin/bash
cat "$1" | pngquant - >"website/docs/img/$2.png"
rm -f "$1"
