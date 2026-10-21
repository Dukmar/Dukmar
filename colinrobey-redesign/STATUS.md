# Redesign status

Updated 2026-10-21. Branch `claude/colinrobey-redesign-fv9xq3` of `Dukmar/Dukmar`.

## Where it stands

A complete, working proposal: 21 pages, every live URL kept, built and pushed. Colin has a
private review link (claude.ai artifact `TmYFhKU6viekuQv3qVFif6`). It was published from the
cloud session that built this, can't be updated from another session, and is now frozen at
the 2026-10-21 version. Use `npm run dev` for the current state.

**Waiting on Colin:** a decision on whether to move forward, and the open decisions below.

## Done

- **Design direction "The Markup":** paper, pine, red pen, highlighter. Bricolage Grotesque
  headlines, Figtree body, Caveat handwriting. The homepage hero is an interactive red-pen
  demo with a slider. The "after" side is on the left, so dragging right "fixes" the site and
  the rebuilt headline is visible at rest. That layout was chosen deliberately; the first two
  versions cut the headline off.
- **Interactive pieces:**
  - the STORY Group before/after slider and speed rings
  - a live PageSpeed checker (calls Google's API from the browser, no key)
  - the anatomy wireframe
  - the "three audiences" tabs
  - a path finder that works without JavaScript
- **Pages:** home, services hub with a comparison table, three service pages, scorecard,
  work, STORY Group case study, how I work, Burlington local page (new), contact (new),
  insights and the six posts, privacy, success, 404. Also `llms.txt`, `robots.txt` (AI
  crawlers allowed by name), RSS and the sitemap.
- **Lighthouse,** mobile, go-live build, local server:
  - home: 94–96 performance
  - build page: 96
  - post: 99
  - all three: 100 accessibility, 100 best practices, 100 SEO
- **2026-10-21:** "no monthly platform fee" changed to "no monthly platform subscription"
  everywhere, plus a new FAQ on the home and build pages, "Are there any ongoing costs after
  launch?".

## Open decisions (Colin)

1. **The new look itself.** It changes the palette and headline font that `DESIGN-BRIEF.md`
   locked on 2026-07-01, so it needs a council run if he likes it.
2. **Phone number** shown in the contact band and footer. The live site shows it in schema only.
3. **New promises in the copy:**
   - replies "within a business day or two"
   - "a coffee is easy to arrange" on the Burlington page
   - the week-by-week process labels
4. **Towns listed:** Burlington, Oakville, Hamilton, Milton, Mississauga, Halton Hills,
   Grimsby, Toronto. Trim them to where he'd really take a meeting.
5. **Humour lines:** the nephew card, "a visitor counter. bold.", "I answer my own email."
6. **The Sheridan credential** stays off (his standing decision). Research rates it the
   strongest trust signal no competitor has.

## Found along the way (not about the redesign, but needs action)

- **Netlify:** Colin's only Netlify team (`cjrobey`, Free plan, created 2025-06-27) holds
  about 80 sites. That includes **storygroup.ca** and colinrobey.ca, alongside teaching tools,
  trip pages and personal apps.
  - Free-plan limits are shared across the team. Per third-party write-ups (not confirmed on
    Netlify's own pricing page), running out pauses every site on the team.
  - Recommendation: give each client their own free Netlify account and GitHub repo, with
    Colin as a collaborator. Start by moving storygroup.ca.
  - This also makes "owned outright" literally true.
- Check the team's actual plan (legacy or credit-based) and current usage in Netlify billing.

## Next steps if Colin says go

1. Get answers on the open decisions above. Run the design through the Website Council.
2. Bring `src/` into `colin-robey-site` on a branch (same Astro 5, same content collection,
   same form names `contact` and `scorecard`).
3. **Port what isn't here yet:**
   - GA4 with the consent banner, the cookieless counter (`netlify/functions/hit*.mjs`)
   - `/go/` short links, the unsubscribe pages
   - `submission-created` (push notification + CRM intake)
   - IndexNow script, the `/sitemap` lastmod logic
   - the Diagnostic page's "three real findings" block
4. Add claims-ledger rows for new copy, and run the prose-tells gate.
5. Run the review flow on review-preview, set `PREVIEW=false`, and merge to main.

## Draft for the live repo

`PROJECT_STATUS-entry.md` in this folder is a drafted entry for
`colin-robey-site/PROJECT_STATUS.md`. It's not added there yet, because that repo deploys on
push to main.
