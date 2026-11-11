# Poster sources

The four posters of `@sondalab/ui-kit` (`.sl-art-poster`, since 0.44) are made
from these images by `scripts/gen-art.mjs`. Each file is a painting by Wassily
Kandinsky from his Bauhaus years, cropped to the poster frame (126 : 78, a
golden rectangle) and reduced to one pixel per poster cell, as a 24-bit BMP of
126 × 78 (29,694 bytes). The generator reads them, so it needs no network and
gives the same output on every machine.

| File | Painting | Poster class | Source |
|---|---|---|---|
| `comp8.bmp` | Composition 8, 1923 | `sl-art-poster` | https://commons.wikimedia.org/wiki/File:Vassily_Kandinsky,_1923_-_Composition_8,_huile_sur_toile,_140_cm_x_201_cm,_Musée_Guggenheim,_New_York.jpg |
| `circles.bmp` | Several Circles, 1926 | `sl-art-poster--circles` | https://commons.wikimedia.org/wiki/File:Vassily_Kandinsky,_1926_-_Several_Circles,_Gugg_0910_25.jpg |
| `yrb.bmp` | Yellow-Red-Blue, 1925 | `sl-art-poster--primary` | https://commons.wikimedia.org/wiki/File:Kandinsky_-_Jaune_Rouge_Bleu.jpg |
| `incircle.bmp` | Circles in a Circle, 1923 | `sl-art-poster--orbit` | https://commons.wikimedia.org/wiki/File:Vassily_Kandinsky,_1923_-_Circles_in_a_Circle.jpg |

## Rights

Kandinsky died in 1944, so these paintings are in the public domain where
copyright lasts for the author's life plus 70 years. In the United States a
work published in 1925 or before is in the public domain, which covers three of
the four; Several Circles is from 1926, and a work published that year entered
the public domain there on 1 January 2022.

These dates were not checked against the licence tag on each Commons page
when the files were added (2026-11-11). Check the four pages before a
release that must rely on them.

## How a file was made

1. The 960px rendition of the Commons file was downloaded.
2. It was cropped to 126 : 78 about its centre. The two square paintings
   (Several Circles, Circles in a Circle) lose their top and their bottom.
3. Each cell of the 126 × 78 grid took the average of the pixels it covers.

To replace a poster, add a BMP of the same size here, list it above, and name
it in `POSTERS` in `scripts/gen-art.mjs`. Then run `npm run gen:art`.
