# Landing RUNBOOK (recipes that cost tokens to rediscover)

## 1. Overflow probe at 390/360 px
Headless Chrome won't lay out below ~500 px viewport width. Load the page inside an `<iframe width=390>` (and 360) in a wrapper page
and measure `document.documentElement.scrollWidth > clientWidth` inside the frame; list offending elements by bounding box.
(DOGEON `scripts/landing-probe.mjs` is the reference implementation: `/mnt/c/Users/dulbi/dogeon/scripts/landing-probe.mjs`.)

## 2. Section screenshot at 1280 px
Anchor screenshots can come out black. Shift the body with a negative top margin to the section's offset, then capture the viewport.
Read the PNG before calling the change done.

## 3. Truth gate
Reference implementation: `/mnt/c/Users/dulbi/dogeon/scripts/landing-check.mjs` (zero deps, parses the app's source of truth and
fails on mismatch). Ours reads `config/` (empty for now) and enforces arepapay-landing-design §5.

## 4. Commands for the user
Write them as bare command lines in a code block, never "run `cmd`" in prose.

## 5. Two-agent rules
`git status --short` before every write; commit with `git commit -m "..." -- <your paths>`; never `git add -A`.
