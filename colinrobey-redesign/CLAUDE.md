# colinrobey.ca redesign — project context

A complete redesign proposal for Colin's consulting site, built as a **separate Astro project**
for review. The live site is a different repo (`Dukmar/colin-robey-site`, deploys on push to
`main`) and must not be touched from here. Nothing in this folder is live.

Read `STATUS.md` for where things stand and what's next. `README.md` has the design rationale,
the competitor research and the full list of decisions waiting on Colin.

## Run and check

```bash
npm install
npm run dev                         # http://localhost:4321
npm run build                       # 21 pages into dist/, must finish with no errors
PREVIEW=false npm run build         # the go-live variant: no noindex, real robots.txt
```

Before calling a change done: build cleanly, look at the page at desktop and phone width
(390px), check there's no sideways scroll, and confirm any new FAQ is visible on the page AND in
the JSON-LD (it comes from the same data, so it should be both or neither).

## Where things live

- **Every business fact is in `src/data/site.ts`**: prices, services, FAQs, towns served, the
  STORY Group numbers and quote, contact details. Pages, schema and `llms.txt` all read from
  it. Change a fact there, never in a page file, or the copy and the schema drift apart.
- `src/layouts/Base.astro`: head, the sitewide JSON-LD graph (LocalBusiness + Person + WebSite
  + WebPage, stable `@id`s), header/footer, small shared scripts.
- `src/layouts/Service.astro`: template for the three paid service pages.
- `src/styles/global.css`: the whole design system. Tokens at the top.
- `src/content/insights/`: the six live posts, copied from the live repo. Keep them in sync
  with the live versions; don't edit them here.
- `scripts/relativize.mjs`: only for making a shareable static bundle (relative links). Not
  needed for Netlify.

## Rules that bite

- **Voice:** "I", never "we" (sole proprietor). Few em dashes; the live site once shipped
  at ~5 per 100 words and that's a known failure. No jargon (robust, leverage, seamless).
- **No outcome promises.** Describe what the site is *built to* do ("built to show up in
  Google and in AI answers"). Never promise rankings, leads or being named by an AI.
- **Hosting wording is settled (2026-10-21):** say "no monthly platform subscription", never
  "no monthly platform fee" or "no running costs". The ongoing-costs FAQ explains the domain
  cost, separate email, and that upgrading past the free plan is the client's call.
- **Facts must be checkable.** Every claim on the live site has a row in the live repo's
  `verification/claims-ledger.md`. New claims written here need a row before go-live. Don't
  invent numbers, clients, reviews or test results.
- **Kept off the site by Colin's decision:** the Sheridan professor role, family and personal
  life, CR Studios and his iOS apps. Don't add them back without him asking.
- **Preview stays on.** `PREVIEW` (in `site.ts`, from the `PREVIEW` env var) puts noindex on
  every page and Disallow in robots.txt. Only switch it off at go-live, on the real domain.
- **Keep the live URLs.** Every existing colinrobey.ca path exists here too. Don't rename slugs
  (e.g. `/services/website-rebuild/` stays, even though the service is called "Website design
  and build").
- **The sample business "Northside Fabrication" is made up** and is always labelled as a
  sample. Real proof is only The STORY Group.
