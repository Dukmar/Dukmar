# Handoff — 2026-10-22 (Thursday)

## Done
- `linkedin/2026-10-22-ai-trust-gap.txt` — LinkedIn post draft (143 words) on the spend-vs-trust gap in Kantar's Media Reactions study. Built on Colin's view: "Trust is the real problem and every new channel is looked at with apprehension." Written with write-like-colin (LinkedIn register); slopcheck `--voice colin` passed (0 em dashes).
- `linkedin/draft-log/2026-10-22-linkedin-ai-trust-gap.md` — the v1 draft log for `/voice-calibrate`. A copy is also at `~/.claude/skills/write-like-colin/drafts/` in the cloud VM, which won't survive the session.
- Topic research: four candidates were offered (spend-vs-trust gap, managing agents instead of people, LinkedIn's AI-content flag, Canada's National Council on AI plus $500M). Colin picked the spend-vs-trust gap.
- Verification: the Kantar figures (net 75% of marketers increasing investment in AI assistant visibility in 2027, 32% of consumers using AI assistants to research brands, 23% or 24% trusting their recommendations; 800+ marketers and 23,000 consumers across 33 markets) agree across several trade write-ups: The Media Leader, Research Live, Bizcommunity, CMO Tech. Colin then sent a screenshot of Kantar's own page, which confirms: a net 75% plan to increase investment in visibility in AI assistants in 2027, including paid ads; 73% use AI assistants; 33% use them to research brands and products; 24% trust brand recommendations from them. v3 uses those exact figures.
- Cut: the "17% have formal processes for how AI represents their brand" figure. It came from an unnamed survey and couldn't be traced.

## Open
- `spend more next year` is correct only if the post goes up in 2026. If it slips into 2027, change it to "this year".
- Kantar is a global study (33 markets). Whether Canada is one of them is unconfirmed. Under the Canadian-sources rule, decide whether a global study is fine for your audience.
- The `voice-linkedin.md` reference (consulting-colinrobey-linkedin skill) isn't installed in the cloud session, so the draft was written without the seven shipped posts as calibration. Expect to add your own opener frame or aside at posting, as calibration rows 8 and 9 predict.

- The .txt now holds v4, Colin's own rewrite (2026-10-22). He asked for it to go into his LinkedIn post review app.
- The review app (`~/Projects/linkedin-review`, deployed to cr-colin-post-review.netlify.app via `./deploy-colin.sh`) exists only on the laptop. It has no GitHub repo, and deploys are laptop-only. Run the prompt in `linkedin/laptop-prompt-review-app.txt`.

- Two other repos were attached read-only to find the review app: `Dukmar/linkedin-cockpit` (the shelved comment-drafting app, not the review app) and `Dukmar/claude-config` (skills; it points to `~/Projects/linkedin-review`). Nothing was changed in either.

## Needs the laptop
- Loading v4 into the LinkedIn review app and deploying it: `linkedin/laptop-prompt-review-app.txt`.
- Posting to LinkedIn (manual, by Colin).
- Moving `linkedin/draft-log/2026-10-22-linkedin-ai-trust-gap.md` into `~/.claude/skills/write-like-colin/drafts/` so `/voice-calibrate` can diff it against the live post.

## Memory candidates
- Colin's stance on AI trust (his words, 2026-10-22): "Trust is the real problem and every new channel is looked at with apprehension." Useful for future AI-positioning posts.
- Kantar's net-75% figure is about investment in *AI visibility* (being recommended by AI assistants), not AI tools in general. It's easy to misquote. Source: Bizcommunity and Research Live headlines, 2026-10.
- The default cloud environment network policy blocks WebFetch and curl to general news and government sites (www.pm.gc.ca was refused with a 403 from the proxy), so source checks need the laptop or a wider allowlist. Source: this session.
- Colin wants stronger openings on his LinkedIn posts (his words, 2026-10-22): "I need better exciting openings to have people read my posts. But still truthful." The hook has to land before LinkedIn's "see more" cut, and every number has to stay exact (for example a net 75% is not "three quarters of marketers").
- 24% trusting AI recommendations does not mean 76% distrust them: the other 76% didn't say they trust them, which includes neutral and unsure. Write "only 24% trust", never "three quarters don't trust". Source: Kantar Media Reactions 2026 chart, checked 2026-10-22 when Colin asked "so 3/4 don't trust it?".
