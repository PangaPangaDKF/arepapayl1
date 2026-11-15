# Landing RUNBOOK (recipes that cost tokens to rediscover)

## 1. Overflow probe at 390/360 px
Headless Chrome won't lay out below ~500 px viewport width. Load the page inside an `<iframe width=390>` (and 360) in a wrapper page
and measure `document.documentElement.scrollWidth > clientWidth` inside the frame; list offending elements by bounding box.
(DOGEON `scripts/landing-probe.mjs` is the reference implementation: `/mnt/c/Users/dulbi/dogeon/scripts/landing-probe.mjs`.)

## 2. Section screenshot at 1280 px
Anchor screenshots can come out black. Shift the body with a negative top margin to the section's offset, then capture the viewport.
Read the PNG before calling the change done.

## 3. Truth gate (`scripts/landing-check.mjs`, implemented D-013)
Zero deps. Walks `landing/out/**.html`; **strips `<script>…</script>` before every text check** because Next inlines the page
text a second time in the RSC payload (`self.__next_f`), which would mask a missing disclaimer or hide a forbidden word. Enforces:
no chain address / chainId unless it is in `config/`; every `data-feature` element carries a `data-status` in
{live,testnet,in-development,planned} (T6); the disclaimer appears ≥2× (hero + footer, T7); no forbidden yield words; no emoji
(true emoji/dingbats, not typographic arrows); only allow-listed external hosts (`arepapay.site`, `x.com`, Google Fonts);
`lang="es"`; local assets exist. Next's generated 404 is exempt from the feature/disclaimer structure. `--file <path>` checks one
file — that is the V9 negative test (plant emoji + a forbidden word, expect exit 1). Reference: DOGEON `scripts/landing-check.mjs`.

## 4. Probe the static export (file:// asset rewrite)
`scripts/landing-probe.mjs` loads `landing/out/index.html` via `file://`. Next exports assets with absolute paths (`/_next/…`,
`/brand/…`), which under `file://` resolve to the filesystem root and never load — so the probe rewrites `="/…"` to
`="file://<out>/…"` first, then CSS/fonts/images load and the overflow numbers mean something. `--file`, `--widths`, `--shot`.

## 5. Build the static export (D-013)
```bash
npm --prefix landing ci           # or: npm --prefix landing install
npm --prefix landing run build    # Next 15 static export -> landing/out/
node scripts/landing-check.mjs    # truth gate (0 problems == pass)
node scripts/landing-probe.mjs    # overflow at 390/360 px
node scripts/landing-probe.mjs --shot '.hero' --out /tmp/hero.png --width 1280   # then read the PNG
```
`out/`, `.next/`, `node_modules/` are gitignored. The probe needs a Chromium (`$CHROME`, else Playwright's in `~/.cache/ms-playwright`).

## 6. Commands for the user
Write them as bare command lines in a code block, never "run `cmd`" in prose.

## 7. Two-agent rules
`git status --short` before every write; commit with `git commit -m "..." -- <your paths>`; never `git add -A`.

## 8. Sub-path build for GitHub Pages + the test link (D-024)
```bash
NEXT_PUBLIC_SITE_URL=https://pangapangadkf.github.io NEXT_BASE_PATH=/arepapay-site npm --prefix landing run build
#   links/assets under /arepapay-site/; canonical + OG image on the Pages host (without SITE_URL they point at arepapay.site)
grep -o 'src="/arepapay-site/[^"]*"' landing/out/index.html | head  # spot-check the prefix
npm --prefix landing run build                                      # rebuild at root before running the gates/probe
```
BRAIN publishes `mvp-url.json` at the site root: `{"url":"https://<tunnel>","updated":"<iso>"}`. `probar/` reads it at runtime
and redirects to `url + '/?net=fuji'`. Test the fallback by opening `out/probar/` with no `mvp-url.json` present.
Tall sections: `node scripts/landing-probe.mjs --shot '#economia' --out shot.png --width 1280 --height 1400`.
