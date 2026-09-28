# tools/

Pages that make assets with the kit, for marketing and for other projects. Not demos (`showcase/`), not probes (`lab/`), and not shipped in the npm package: each imports the kit from `../../packages/ui-kit/` so it always runs the working tree.

Serve the repo root over http (ES modules do not load from `file://`):

    python3 lab/_serve.py        # then http://localhost:8891/tools/halftone/

- `halftone/` — any picture as a halftone of round dots, the same engine as `data-sl-halftone`. Downloads SVG (vector, for print) and PNG at the chosen size; the seed makes an export reproducible.
