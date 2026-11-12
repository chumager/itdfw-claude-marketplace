#!/usr/bin/env bash
# Renders fixtures/menu-in/menu-1.png: an INVENTED printed menu ("Sample Cafe", 12 items, one with two portions, one printed
# with a deliberate misprint). Needs ImageMagick (`magick`) and the DejaVu fonts. The matching answer is menu-reference.json.
# Usage: bash fixtures/make-menu.sh
set -eu
here=$(cd "$(dirname "$0")" && pwd)
out="$here/menu-in/menu-1.png"
mkdir -p "$here/menu-in"
bold=DejaVu-Sans-Bold
plain=DejaVu-Sans

args=(-size 1000x1560 xc:'#fbf7ee' -fill '#222222')
y=90
put() { args+=(-font "$1" -pointsize "$2" -annotate "+$3+$y" "$4"); } # font size x text
item() { # name price description
  put $bold 30 60 "$1"
  put $bold 30 780 "$2"
  y=$((y + 34))
  put $plain 22 60 "$3"
  y=$((y + 52))
}
section() {
  y=$((y + 14))
  put $bold 38 60 "$1"
  y=$((y + 14))
  args+=(-draw "line 60,$y 940,$y")
  y=$((y + 46))
}

put $bold 56 60 "SAMPLE CAFE"; y=$((y + 40))
put $plain 22 60 "Fictional menu used only as a test fixture"; y=$((y + 50))

section "STARTERS"
item "SAMPLE DISH 1" '$4.500' "Invented description of the first sample dish"
item "SAMPLE DISH 2" '$5.200' "Another invented description"
item "SAMPLE DISH 3" '$3.900' "Short invented text"
item "SAMPLE DISH 4" '$6.100' "Fourth made-up starter with a longer line"

section "MAIN COURSES"
item "SAMPLE DISH 5" '$9.800' "Invented main course number five"
item "SAMPLE DISH 6" '$10.500' "Invented main course number six"
item "SAMPLE DISH 7" '$8.700' "Invented main course number seven"
# two portions printed one under the other: ONE product with two priced variants
put $bold 30 60 "SAMPLE DISH 8"
put $bold 30 640 'SMALL $6.500'
y=$((y + 40))
put $bold 30 640 'LARGE $9.500'
y=$((y + 40))
put $plain 22 60 "Sold in two portions"
y=$((y + 52))
# deliberate misprint: the printed word is "DIHS"; a faithful transcription keeps it
item "SAMPLE DIHS 9" '$11.200' "Printed with a typo on purpose"

section "DRINKS"
item "SAMPLE DRINK 1" '$2.500' "Invented drink"
item "SAMPLE DRINK 2" '$3.100' "Another invented drink"
item "SAMPLE DRINK 3" '$3.700' "Third invented drink"

magick "${args[@]}" "$out"
echo "wrote $out"
