# Requirements checklist

Every requirement in the project brief (version 3), the feature that meets it, and how it was proved.

**Status:**
- ✅ built and passing its checks
- 🟡 built and checked in a simulated Google environment; to be confirmed live after the Google setup
- ⏳ waiting for the district

Test names refer to `tests/unit/*.test.mjs` (U) and `tests/site/site.test.mjs` (S); "browser" means checked by hand at phone and desktop width.

| # | Brief | Requirement | Feature | Proof | Status |
|---|---|---|---|---|---|
| 1 | §2 | Home: latest activities, newest magazine, upcoming events, recognitions, this week's celebrations | `src/index.njk` | S: page counts, links; browser | ✅ |
| 2 | §2 | ~100 club pages from the database, office bearers (name, role, club), recent activities, buttons to club website/social | `src/club.njk` | S: one page per club; browser | ✅ (70 clubs in sample) |
| 3 | §2 | Activities feed, filter by club or theme (7 Areas of Focus + Club service / Other) | `src/activities.njk`, `filters.js` | browser: filter by theme shows only that theme | ✅ |
| 4 | §2 | Events calendar with date, place, organiser; past events link to reports; add to phone calendar | `events.njk`, `event.njk`, `.ics` files, Google Calendar link | S: valid calendar files in India time; browser | ✅ |
| 5 | §2 | Monthly magazine: newest on home with cover, archive by year/month, PDF | `magazine.njk`; Sheet script scans the 3110Magazines folder | S: links; U(sim): data link | ✅ / 🟡 folder scan |
| 6 | §2 | Messages page, DG featured on top | `messages.njk` | browser | ✅ (sample messages, no real names) |
| 7 | §2 | District Leadership page (Governor line, office team, AGs by zone, Counsellors, College of Governors) | `leadership.njk` | S: every Excel person listed | ✅ |
| 8 | §2 | Teams & Committees page: team leader, committees with chairmen and co-chairmen by zone; "Past years" | `teams.njk`, year switch | S: every Excel person listed; browser | ✅ |
| 9 | §2 | One search over name, team, committee, role, club; a person appears once with all roles | `people-search.js` | browser: PDG Sharat Chandra → 1 person, 4 roles | ✅ |
| 10 | §2 | Professional directory: profession + place search, ~20-word line, optional website, contact only if agreed | `directory.njk`, `directory.js` | S: WhatsApp links only where agreed; browser | ✅ |
| 11 | §2 | Directory listing follows a member who moves club | Listings keyed by member, club looked up at build | U: public members | ✅ |
| 12 | §2 | Member spotlight, chosen by moderators | `spotlights` tab, `spotlight.njk` | browser | ✅ |
| 13 | §2 | Member photos with their own consent, everywhere the person appears; initials otherwise | Core rules + avatars | U: photo only with consent; S: member photos < 40 KB | ✅ |
| 14 | §2 | Celebrations this week: day and month only, couples' anniversaries need both, couples in two clubs shown once with both clubs, couple photo with both consents, no non-member spouse birthdays | `celebrations.js`, Core rules | U: couples; U(sim): Rotarian spouses in two clubs; S: no years | ✅ |
| 15 | §2 | Celebrations stop at once for someone who passed away | "Mark as deceased" + `inactive_keys` guard | U(sim): mark as deceased; U: privacy check | 🟡 |
| 16 | §2 | Recognition: most active per member (min 3), most consistent, story of the month | `lib/recognition.mjs` | U: worked examples; S: home page matches September 2026 sample | ✅ |
| 17 | §2 | Privacy notice page | `privacy.njk` | browser | ✅ (wording ⏳ lawyer) |
| 18 | §3 | No Join Rotary, no Rotary India/My Rotary links, no logins, payments, prices or ads | Not built; no such links | Code review | ✅ |
| 19 | §3 | No phone numbers/emails/member IDs on the site except agreed WhatsApp buttons | Core privacy check; build stops | U: guard tests; S: scan of every built file | ✅ |
| 20 | §4 | Activity/event form with all listed questions, club from a list, photos < 1 MB, sign-in | Sheet script `Forms.js` + photo question by hand | U(sim): submission flows | 🟡 |
| 21 | §4 | Club profile form; updates apply after approval | `Forms.js`, `applyClubProfile_` | U(sim): club profile | 🟡 |
| 22 | §4 | Consent form (member or secretary), separate ticks, day/month only, spouse handling, optional member ID | `Forms.js`, `Members.js` | U(sim): consent tests | 🟡 |
| 23 | §4 | Removal form; either spouse can withdraw shared items; photos deleted | `approveRemoval` | U(sim): removal | 🟡 |
| 24 | §4 | Everything pending until a moderator approves; who and when recorded | Status column, Rotary menu | U(sim): approve stamps who/when; S: no pending entries anywhere | 🟡 |
| 25 | §4 | 48-hour reminders; submitter told of approval/rejection; duplicate flag; original wording kept | `Jobs.js`, `notifySubmitter_`, `Core_findDuplicate`, raw tabs | U(sim): reminders, emails; U: duplicate check | 🟡 |
| 26 | §4 | Activity needs a photo or post link | Approve refuses; build skips | U(sim) + U: skipped activity | ✅ |
| 27 | §4 | Monthly nudge dashboard and success measure | `dashboard` tab | U(sim): one row per active club | 🟡 |
| 28 | §4 | Records keyed by Rotary club/member IDs; club and role history kept; inactive clubs kept | Schema, `club_history`, `rotary_year` on roles | Sample covers transfers and an inactive club | ✅ (real IDs ⏳) |
| 29 | §4 | Teams data for 2024-25 from the Excel, names/roles/clubs only, spelling fixed | `tools/convert-excel.mjs` | Conversion report: 176 = 176 rows, 0 phones/emails | ✅ |
| 30 | §4 | Magazine: drop `YYYY-MM.pdf` in 3110Magazines | `scanMagazines_` | U(sim) data link | 🟡 |
| 31 | §4 | Weekly refresh Sunday 6 am IST + "Rebuild site now" | GitHub Actions schedule + 15-minute check | Workflow runs green | ✅ / 🟡 rebuild-now after setup |
| 32 | §5 | Public tabs never contain a birth/marriage year, unconsented member, etc.; build fails otherwise | `scripts/validate-public.mjs` | U: build-guard tests (birth year, not opted in, phone number) | ✅ |
| 33 | §5 | Photos stripped of location data, resized | `scripts/fetch-media.mjs` | Code review (sharp drops metadata); S: sizes | ✅ |
| 34 | §5 | Directory and celebrations kept out of search; member photos kept out of image search | noindex, robots rules, data files blocked | S: noindex/robots tests | ✅ (robots ⏳ domain) |
| 35 | §5 | Main and private Sheets restricted; magazine folder public; photos folder private | Checked by setup | Verified on Drive today; setup re-checks | ✅ |
| 36 | §5 | Scam warning in footer and privacy notice | `base.njk`, `privacy.njk` | browser | ✅ |
| 37 | §7 | Rotary brand: logo as given, white header, Royal Blue and Gold, Open Sans | CSS, brand assets | browser | ✅ |
| 38 | §7 | English now, structure for Hindi | All wording in `src/_data/t.json` | Code review | ✅ |
| 39 | §7 | Phone-first, light on slow connections | CSS, lazy images | S: home + CSS + JS < 200 KB, JS < 30 KB; browser: no sideways scroll | ✅ |
| 40 | §8 | Titles/descriptions, sitemap, event labels for Google, WhatsApp preview cards, updates feed | Layout meta, `machine.njk` | S: every page has preview; activity uses own photo < 300 KB | ✅ |
| 41 | §8 | Block AI crawlers | `robots.txt` | S: robots test | ✅ (works at the domain root) |
| 42 | §8 | Privacy-friendly visitor statistics | Cloudflare beacon when `CF_BEACON_TOKEN` is set | Code review | ⏳ Cloudflare account |
| 43 | §9 | Free hosting, accounts under the district | GitHub Pages on rotarian-neerav | Live | ✅ |
| 44 | §9 | One command clears all sample data | Rotary → Sample data → Clear all sample data | U(sim): clear keeps real rows, site data still valid | 🟡 |
| 45 | §9 | Weekly public-data backup | Snapshot step in the workflow | Runs on scheduled builds | 🟡 first Sunday |
| 46 | §12 | Launch items (moderators, IDs, professions, lawyer, domain, etc.) | `docs/yearly-update-and-launch.md` | – | ⏳ |
