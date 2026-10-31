# Rotary District 3110 website – notes for Claude

The district's website, built by Eleventy from a Google Sheet and published on GitHub Pages. Clubs send
activities through Google Forms; moderators approve them; a protected Apps Script web app returns only approved
rows and public fields; GitHub Actions builds and publishes. The README has the folders, commands and the diagram.

This repository is **public**. Never commit members' data, phone numbers, emails, secrets, or Google document IDs.

## Where things are

- `apps-script/Core.js` – the rules for what may become public. Used by both the Sheet script and the website
  build, so a change there changes both. Other `apps-script/*.js` files are the Sheet script.
- `dist/apps-script/Code.gs` – the bundled Sheet script (`npm run bundle-script`), tracked in git. Someone pastes
  it into the Sheet's Apps Script editor and deploys a new version of the same web app deployment; the website
  cannot change the Sheet script by itself.
- `src/` pages (Nunjucks), `src/_data/t.json` all page wording, `lib/` data shaping for pages, `scripts/` build steps.
- `tests/unit/` (rules, recognition, the Sheet script in a mock Google environment: `tests/helpers/google-mock.mjs`)
  and `tests/site/` (checks on the built `_site/`).
- `docs/` guides for the district: Google setup, moderator guide, yearly update, requirements checklist.

## Working on it

- `npm test` after every change; for page or template changes also build and check the site:
  `node scripts/fetch-data.mjs --sample && npm run validate && npm run media && npm run eleventy && npm run search && npm run test:site`.
- A change to `apps-script/` needs `npm run bundle-script` and the bundled file committed with it.
- New behaviour gets a test in the matching file. The Sheet script is tested through the mock; extend the mock
  (it should behave like Google, including limits) rather than working around it.
- Pushing to `main` builds and publishes the site. The build also runs on a schedule (every 15 minutes it checks
  whether a moderator pressed "Rebuild site now"; Sundays it always builds).

## Style

- Plain English for district readers: short sentences, no jargon. Indian number formatting (2,10,691; lakh, crore).
- Code reads like the code around it: same naming, sparse comments that say why.
- Commit messages are plain sentences saying what changed for the district, then a short body with the reason.

## Things that have bitten us

- GitHub's scheduled runs are often 15–60 minutes late. Runs share one queue: a newer waiting run cancels the
  older waiting one. A job's log is readable only after the job ends.
- Processed photos are cached between builds and saved right after the build step, so a failed check later does
  not mean processing every photo again (a year of activities takes about 45 minutes).
- Apps Script: the cache holds at most 100 KB per value (the allowed-files list is kept in parts); a run stops
  after 6 minutes; the Sheet menu's Reject emails the person who submitted the row.
- Eleventy renders computed front matter with Nunjucks escaping on, so those values arrive HTML-escaped; the page
  head unescapes them (`unescaped` filter) before escaping once. `json` writes `<` as `<`.
- Real club data has apostrophes, quotes, `&`, HEIC photos, dates typed wrongly. Sample data should include
  such cases so the tests meet them before the live build does.
