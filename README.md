# Rotary District 3110 website

The district's website: what our clubs achieve. Built from the district Google Sheet, published free on GitHub Pages.

- **Live (test) address:** https://rotarian-neerav.github.io/rotary3110-website/
- **Project brief:** `../3110-Website-Project-Brief.md` (version 4.2)
- **Guides:** [Google setup](docs/3110-Website-Google-Sheet-Setup.md) · [Moderator guide](docs/3110-Website-Moderator-Guide.md) · [Yearly update and launch](docs/3110-Website-Yearly-Update-and-Launch.md)

## How it works

```
Google Forms ──► main Sheet "3110Website" (pending) ──► moderator approves (Rotary menu)
                     │                                         │
Private members Sheet ┘ (consent, spouses, never published)    ▼
                                         protected data link (Apps Script web app)
                                         returns approved rows + public fields only
                                                               │
GitHub Actions: Sundays 6 am IST, or within ~30 min of "Rebuild site now"
   fetch ─► privacy check (stops on unsafe data) ─► photos resized, location data removed ─► Eleventy ─► tests ─► GitHub Pages
```

The Sheet also emails the moderators a preview of the weekly bulletin on Saturday evening, and on Sunday morning the WhatsApp message for someone to forward to the district groups.

The rules for what may become public live in one file, [apps-script/Core.js](apps-script/Core.js), used by **both** the Sheet script and the website build, and covered by the tests.

## Folders

| Folder | What is in it |
|---|---|
| `apps-script/` | The Google Sheet script (setup, forms, moderation, members, data link). `npm run bundle-script` joins it into `dist/apps-script/Code.gs` to paste into the Sheet. |
| `src/` | Website pages (Nunjucks templates), styles, small scripts, and `_data/t.json` with all page wording (a Hindi file can be added later). |
| `lib/` | Shapes the data for pages; recognition maths. |
| `scripts/` | Build steps: fetch data, privacy check, photos, emptying `_site/` before each build. |
| `sample/` | Sample (dummy) data and placeholder images. Every row is marked `is_sample`. |
| `tools/` | One-off tools: Excel conversion, sample generator, brand assets, script bundler. |
| `tests/` | Unit tests (rules, recognition, Sheet script in a simulated Google environment) and checks on the built site. |
| `docs/` | Guides and reports. |
| `data-snapshots/` | A dated copy of the public data, saved by each scheduled build. |

## Commands

```bash
npm install            # once
npm test               # unit tests (privacy rules, recognition, Sheet script)
npm run build          # fetch → privacy check → photos → site in _site/ → search index (Pagefind)
npm run test:site      # checks on the built site
npm run serve          # local preview at http://localhost:8080
npm run bundle-script  # make dist/apps-script/Code.gs for the Sheet
npm run make-sample    # regenerate the sample data
```

Without `DATA_URL` and `DATA_TOKEN` the build uses `sample/sample-data.json`. With them (set as GitHub secrets) it reads the live Sheet.

## GitHub settings

| Name | Kind | Value |
|---|---|---|
| `DATA_URL` | secret | The Apps Script web app address (`…/exec`) |
| `DATA_TOKEN` | secret | Token shown by Rotary → Administrator → Show data link details |
| `SITE_URL` | variable (optional) | e.g. `https://rotary3110.org` once the domain is bought |
| `PATH_PREFIX` | variable (optional) | `/` once on the domain (default `/rotary3110-website/`) |
| `CF_BEACON_TOKEN` | variable (optional) | Cloudflare Web Analytics token |

## Moving to the district domain

1. Buy the domain under rotarian.neerav@gmail.com.
2. GitHub → repository Settings → Pages → Custom domain → enter it; add the DNS records GitHub shows at the domain seller.
3. Set the variables `SITE_URL=https://<domain>` and `PATH_PREFIX=/`, then run the workflow.
4. Update `site_url` in the Sheet's settings tab.
5. Note: `robots.txt` (AI-crawler blocking, image-search rules) only takes effect at a domain's root, so it starts working once the site is on its own domain.
