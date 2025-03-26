#!/bin/bash
cat "$1" | pngquant - >"docs/img/$2.png"
rm -f "$1"
