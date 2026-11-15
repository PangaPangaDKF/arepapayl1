# arepapay-landing-design changelog (newest first)

## 1.1 · 2026-11-15 · D-004 — LANDING took the lane; launch stack = Next.js static export
- Loaded `vercel-react-best-practices` into the landing agent. Set the launch stack to Next.js (App Router) static export,
  superseding the single-file/no-framework rule, for SEO/OG/Twitter-card and image optimization on a real domain.
- Lesson: a framework is allowed only when it earns its weight (R8). Static export keeps the output as plain HTML, so the truth
  and overflow gates still apply unchanged — if a future stack stops emitting static HTML, the gates must be rebuilt first.
- Lesson: brand (logo, exact palette) must come from the user's own source (their X), never invented (T8). Until it arrives,
  build on the §3 cream/navy/gold tokens with no logo rather than guess one.

## 1.0 · 2026-11-14 · D-003 — created by BRAIN
Seeded from DOGEON landing skill 2.1. Lessons carried over:
- Lesson (DOGEON D-085): a hallucinated RPC on a parked domain shipped on the first landing. Chain facts only from config, verified live.
- Lesson (ArepaPay v1, 2026-11-14): the DeepSeek landing stated planned KYC and encryption as fact and showed fake contacts.
  Status labels (T6) and no invented contacts (T8) are now hard rules checked by the gate.
