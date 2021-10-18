# converting svg to png for mac logo

Process to make icon programmatically from svg

```

## convert svt to png
rsvg-convert color_logo.svg -b white -w 568 -o color_logo.png

## heuristically determined crop, trying to aim to make the logo reach up to the top of the cropped area
convert -crop 512x512+20+45 color_logo.png color_logo_cropped.png


## create rounded rectangle transparency
convert -size 512x512 xc:none -fill white -draw 'roundRectangle 50,50 462,462 50,50' color_logo_cropped.png -compose SrcIn -composite color_logo_rounded.png


convert -resize 256x256 color_logo_rounded.png color_logo_rounded_256.png

## create .icns file
png2icns icon.icns color_logo_rounded.png color_logo_rounded_256.png

```
