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
| 7 | §2 | District Leadership page (Governor line, office team, AGs with the clubs they look after (by zone until Release A), Counsellors, College of Governors) | `leadership.njk` | S: every Excel person listed | ✅ |
| 8 | §2 | Teams & Committees page: team leader, committees with chairmen and co-chairmen; "Past years" | `teams.njk`, year switch | S: every Excel person listed; browser | ✅ |
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

### Added in October 2026

| # | Requirement | Feature | Proof | Status |
|---|---|---|---|---|
| 47 | Form buttons open in a new tab | Build step in `eleventy.config.js` | S: form links open in a new tab | ✅ |
| 48 | Club page links to all its members | `src/club-members.njk` (role holders, plus members who agreed; "12 of 45 listed") | U: office bearers first; S: every club has a members page | ✅ |
| 49 | Office bearers (and team members) open their member card | Links matched by member ID through a scrambled reference | S: every office bearer with an ID links to a working card | ✅ |
| 50 | Member card: everything the member agreed to show; every position, newest year first; old years kept | `src/member.njk`, `lib/derive.mjs` | U: Sharat Chandra's 4 roles, newest first, no unconsented fields; S: card checks | ✅ |
| 51 | No birthday, anniversary, spouse or mobile number on cards; cards of people who have not consented hidden from search engines | `member.njk` | S: card checks, sitemap | ✅ |
| 52 | Someone deceased or departed: no card or listing; this year's roles hidden; past roles and spotlight stories keep the name as plain text | `Core_buildPublicData` (inactive IDs from the private Sheet) | U: deceased and left; S: deceased sample member | 🟡 live after the script update |
| 53 | Home page order: achievements, events, latest, recognition, spotlight, celebrations, magazine, messages | `src/index.njk` | S: section order | ✅ |
| 54 | Home page events: at most 8, all district events first (the next 8 if there are more) | `homeEvents` in `lib/derive.mjs` | U: worked cases; S: home page | ✅ |
| 55 | Moderators see roles whose member ID is missing or wrong | Rotary → Check roles and member IDs (and every morning), `role_checks` tab | U: role check cases; U(sim): tab filled | 🟡 live after the script update |
| 56 | Search engines get every page (the sitemap had only the first club, activity and event) | `addAllPagesToCollections` | S: every club, activity and event in the sitemap | ✅ |

### modifications1 (October 2026): club services and projects, district campaigns, weekly bulletin

M = `tests/unit/modifications1.test.mjs`. Ten deliberate mistakes (ignoring `bulletin_exclude`, several activities per club, counting work after a campaign ends, "Postponed" showing "Registration open", "none" not clearing, the approval window, question placement, an over-long message, a phone line or a payment fee kept) were each caught by the tests.

| # | Requirement | Feature | Proof | Status |
|---|---|---|---|---|
| M1.1 | Club profile form asks for permanent projects and regular services, one per line | Two questions before Confirmation (new forms and, through Upgrade Sheet, the existing form) | U(sim): questions added once, in place | 🟡 live after the upgrade |
| M1.2 | Approval replaces the lists; blank keeps them; "none" clears them; notes for phone numbers, emails and long lines | `applyClubProfile_`, `fileClubProfile_` | U(sim): blank, none, replace, notes | 🟡 live after the upgrade |
| M1.3 | Club page shows services and projects between office bearers and activities; clubs list shows counts; lines with a phone number or email are dropped without stopping the build | `Core_cleanLines`, `club.njk`, `clubs.njk` | M: cleaning, 160 characters, 12 lines; S: club pages; sample includes a phone line, listed in `skipped_items` | ✅ |
| M2.1 | Moderators list campaigns in a `campaigns` tab; the activity form offers open campaigns (until 30 days after the end) and a count | Campaign questions, `Core_openCampaigns`, daily form-list refresh | M: label round trip, 30-day rule; U(sim): dropdown | 🟡 live after the upgrade |
| M2.2 | Filing notes: count without campaign, date outside the campaign, large count, another club the same date | `campaignNotes_` | U(sim): each note | 🟡 live after the upgrade |
| M2.3 | Running totals: approved reports only; work dated inside the campaign only (agreed correction); joint activities count for the submitting club only; a report without a count adds 0 | `Core_campaignTotals` | M: 204 + 22 + 65 = 291, partners no credit, pending/rejected/out-of-period excluded | ✅ |
| M2.4 | Campaign pages by Rotary year; home band while running; tag on activities; line on club pages; chair links to their card; nothing when there are no campaigns | `campaigns.njk`, `campaign.njk`, `index.njk` | M: no campaigns → nothing; S: totals, home band, tags | ✅ |
| M3.1 | Weekly bulletin assembled from approved data by fixed rules, shared by the website and the Sheet | `Core_bulletin` | M: approval window (Sat 11 pm in, Sun 9 am next week), one per club, rotation by city (by zone until Release A), story first, excluded rows, coming-up window, closing soon, campaign totals, quiet week | ✅ |
| M3.2 | `/bulletin/`, a dated page per Sunday from `bulletin_start_date`, archive; dated pages in the sitemap; past bulletins keep their registration lines (agreed correction) | `bulletin*.njk` | M: archive, unchanged past bulletin; S: pages, canonical, sitemap | ✅ |
| M3.3 | WhatsApp message of at most 1,000 characters, Copy and Share buttons | `Core_bulletinMessage`, `bulletin.js` | M: lines and length; S: message on the page | ✅ |
| M3.4 | Event registration: closing date and fee on the form; status set by moderators; line worked out, never typed; cancelled events stay listed (and calendar files say cancelled) | `Core_registrationLine` | M: every case; S: cancelled, postponed, fee | ✅ / 🟡 form after the upgrade |
| M3.5 | Fee never shows payment details; the privacy check refuses UPI, IFSC or A/c | `Core_buildPublicData`, `Core_validatePublic` | M: fee dropped and listed; check refuses | ✅ |
| M3.6 | Saturday 6 pm preview to moderators; Sunday 8 am message to `bulletin_emails`, sent once the page is live (agreed correction), otherwise a rebuild and hourly retries | `bulletinPreview`, `bulletinMessage` | U(sim): preview; message waits, retries, sends once, same text as the website | 🟡 live after the upgrade |
| M3.7 | `bulletin_exclude` is a TRUE/FALSE dropdown, not a tick box (agreed correction: tick boxes push new rows far down the tab) | `addValidation_` | Code review; U(sim): no empty rows above new entries | ✅ |
| M3.8 | No menu entries for the bulletin or campaigns; footer links instead | `base.njk` | S: menu and footer | ✅ |
| M4 | One upgrade step for the live Sheet, safe to run twice | Administrator → Upgrade Sheet | U(sim): run twice, everything once | 🟡 to run |

### Release A (17 October 2026)

A = `tests/unit/release-a.test.mjs`, SA = `tests/site/release-a.test.mjs`, U(sim) = the Sheet script in the simulated Google environment.

| # | Requirement | Feature | Proof | Status |
|---|---|---|---|---|
| A1 | Clubs page by city, with search and a meeting-day filter; meeting day asked on the club profile form, else read from the meeting text | `clubs.njk`, `clubs.js`, `Core_meetingDay` | A: day rules; SA: every club once, its day; U(sim): weekday applied on approval; browser | ✅ / 🟡 form after the upgrade |
| A2 | Rotary-year and Avenue of Service filters on Activities; avenue asked on the activity form (required) | `activities.njk`, `filters.js`, `CORE_AVENUES` | SA: filters match cards; U(sim): question in place, required; browser | ✅ / 🟡 form after the upgrade |
| A3 | About page: RI President and DG profiles, every Past District Governor, glossary | `about.njk`, `profiles` and `past_governors` tabs | A: latest profile, PDGs newest first, cards only with an ID, fallback to the College of Governors; SA: page | ✅ (sample rows) |
| A4 | Rotary abbreviations explained where first used on each page | `lib/gloss.mjs`, `site.js` | A: first use, longest match, never in tags/scripts/glossary; SA: once per page; browser: tap shows meaning | ✅ |
| A5 | Year summary page for each Rotary year | `years.njk`, `year.njk` | A: totals add up; SA: matches data | ✅ |
| A6 | "More like this" on activity and event pages | `derive.mjs`, `activity.njk`, `event.njk` | A, SA: never the page itself; browser | ✅ |
| A7 | City pages for every city, one-club towns included | `cities.njk`, `city.njk` | A, SA: every active club in one city | ✅ |
| A8 | Services the public can use, with the facility's own phone, address and map; the privacy check allows only these numbers | Public service form, `public_services` tab, `services.njk`, `Core_servicePhone`, `Core_validatePublic` | A: phone rules, bad numbers and emails left out, check refuses a number elsewhere; U(sim): notes, refused approval, public; SA: tap-to-call; browser | ✅ / 🟡 form after the upgrade |
| A9 | "Open to everyone" on events, with a filter | `open_to_all`, `events.js` | A, U(sim), SA, browser | ✅ |
| A10 | Contact form inside the Contact page; messages to the district email, kept privately; spam and a daily limit | Contact form, `contact_messages` (private), `fileContact_` | U(sim): emailed, spam held, limit, never public; SA: no email address on the site | 🟡 live after the upgrade; `contact_email` to set |
| A11 | One calendar subscription for all events | `/events/calendar.ics`, webcal and Google links | SA: valid calendar, cancellations | ✅ |
| A12 | In the news: paper, date and link on the activity, and a news page | `press_*` columns, `news.njk` | A, U(sim), SA | ✅ / 🟡 form after the upgrade |
| A13 | Rotary month banner, picked by the visitor's own date | `rotaryMonths.js`, `index.njk`, `site.js` | SA: 12 months, one showing; browser | ✅ |
| A14 | Video links: YouTube plays on tap (no-cookie player); others are links | `Core_videoLink`, `videoBlock` | A: link kinds; SA: nothing loads until tapped; browser | ✅ |
| A15 | Add to home screen, larger text, recent pages offline | `manifest.webmanifest`, icons, `sw.js`, text-size button | SA: manifest and icons, offline page; browser: installed, pages kept, text size remembered | ✅ |
| A16 | Posting guide; each club's own form link with the club chosen (private) | `how-to-post.njk`, `makeClubFormLinks_` | U(sim): every active club, never published; SA: page | ✅ |
| A17 | Activity pages marked as news articles for Google | NewsArticle JSON-LD | SA: every activity page | ✅ |
| A18 | Monthly private email of clubs not posting (dummy receiver for now) | `notPostingReport`, `Core_clubsNotPosting` | A: rules; U(sim): email | 🟡 live after the upgrade |
| A19 | Site search | Pagefind, `search.njk` | SA: only listable pages indexed; browser: results | ✅ |
| A20 | Zones off the website; Assistant Governors with their clubs; bulletin rotates by city | `Core_buildPublicData`, `Core_validatePublic`, `leadership.njk` | A: no zone in the data, check refuses one; SA: no zone on any page; M: city rotation | ✅ (`ag_clubs` to fill) |
