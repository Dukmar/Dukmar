<!-- Paste the section below at the top of colin-robey-site/PROJECT_STATUS.md (under the
     "Updated" lines), and add "Previous: 2026-10-21 (redesign proposal built separately)" to the
     header list. Commit it on a branch or with your usual review flow: a push to main deploys. -->

## 2026-10-21 — Redesign proposal built separately, NOT LIVE, nothing in this repo changed

- A complete redesign of the site was built as a separate Astro project for review:
  `Dukmar/Dukmar`, branch `claude/colinrobey-redesign-fv9xq3`, folder `colinrobey-redesign/`.
  Start with that folder's `STATUS.md`. Its `README.md` has the design rationale and the
  competitor research.
- **Direction "The Markup":**
  - red pen and highlighter on paper, pine bands, Bricolage Grotesque headlines
  - an interactive before/after hero demo
  - the real STORY Group before/after slider
  - a live PageSpeed checker, and a price ladder with a comparison table
  - all 21 live URLs kept, plus a Burlington local page and a contact page
- **Lighthouse,** mobile, go-live build, local server: 94–99 performance; 100 for
  accessibility, best practices and SEO.
- It **departs from DESIGN-BRIEF.md**: a new palette and headline font. It needs a council run
  before adoption. Open decisions are listed in the redesign's `STATUS.md`: phone number on the
  page, new copy promises, towns listed, humour lines, Sheridan credential.
- **Wording change agreed 2026-10-21:** "no monthly platform subscription" replaces "no
  monthly platform fee", with an ongoing-costs FAQ (domain cost, separate email, upgrading past
  the free plan is the client's call). This applies to the live site too: the live copy still
  says "no monthly platform fee" in several places (homepage offer card, rebuild page, FAQs,
  case study, llms.txt). Change it through the review flow.
- **Hosting risk found:** the `cjrobey` Netlify team (Free plan) holds about 80 sites,
  including storygroup.ca and colinrobey.ca. Free-plan limits are shared across the team.
  Plan: give each client their own free Netlify account and repo, starting with storygroup.ca.
