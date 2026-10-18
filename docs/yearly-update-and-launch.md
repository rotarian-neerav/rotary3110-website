# Yearly update (July) and launch checklist

## Before launch: replacing the sample data

1. In the Sheet: **Rotary → Sample data → Clear all sample data…** removes every row marked `is_sample` from both Sheets.
   This also removes the 2024-25 teams and committees loaded from the district Excel, because they were marked as sample as agreed.
2. Load the real data (paste into each tab, keeping the column order; leave `is_sample` empty):
   - **clubs**: real Rotary club IDs, names, city, zone (for the district's own use; never shown on the website), member count, and meeting day if known.
   - **officers**: one row per office bearer: Rotary year, club ID, member ID, name, role.
   - **functionaries**: teams and committees, one row per person per role (see the `page`, `section`, `committee`, `role`, `zone`, `term` columns). For each Assistant Governor, list the clubs they look after in `ag_clubs` (club names or IDs, separated by commas).
   - **past_governors**: every Past District Governor, including those no longer with us: Rotary year, name, club, and member ID if they are living (the member ID only links their card; it is never shown).
   - **profiles**: the RI President and the District Governor for the About page: role, Rotary year, name, theme, a short profile, a photo the district may use (Drive file), and a link.
   - **public_services**: facilities the clubs run (or ask clubs to send the public service form).
   - **members_master** (private Sheet): the full member list, with Rotary member IDs, club, mobile, date of birth, marriage date.
   - **club_history** (private Sheet): one row per member per club, with from and to dates.
3. Update **settings → current_rotary_year**.
4. **Rotary → Update form lists** (so the forms show the real clubs).
5. **settings → bulletin_start_date**: the Sunday of the public launch (e.g. `2026-11-01`). The bulletin archive starts there. Fill in **bulletin_emails** with whoever forwards the Sunday message.
6. **Rotary → Rebuild site now.**

## Every July (new Rotary year)

The July update **adds** rows; it never overwrites last year's, so history is kept.

1. **officers**: add the new year's office bearers with the new `rotary_year`. Leave last year's rows.
2. **functionaries**: add the new year's teams and committees with the new `rotary_year`. Last year's teams stay visible under "Past years".
3. **settings → current_rotary_year**: set the new year (e.g. `2027-28`).
4. **clubs**: update member counts; mark closed clubs `inactive` (never delete them); add new clubs.
5. **Members who moved clubs** (private Sheet): in **club_history**, put an end date on the old club row and add a new row for the new club. Change `club_id` in **members_master**.
6. **Rotary → Check roles and member IDs**: fix anything in the **role_checks** tab, so each person's new roles join their member card. Last year's roles stay on the cards under last year.
7. **campaigns**: add the new year's district campaigns (see the moderator guide). Last year's campaign pages stay, under last year.
8. **past_governors**: add the governor who has just finished. **profiles**: add the new RI President and District Governor (the newest row of each role is shown). **functionaries**: fill in `ag_clubs` for the new Assistant Governors.
9. **Rotary → Update form lists** (this also renews each club's own form link), then **Rotary → Rebuild site now**.

## Launch checklist (from the brief, section 12)

| Item | Who | Status |
|---|---|---|
| Named owner for the yearly update, with a backup | District | Open |
| Real names and Google emails of the four moderators (add them to the Sheet as editors and to `settings → moderator_emails`) | District | Open |
| Real Rotary club IDs | District | Open (dummy S-001…) |
| Rotary member IDs for office bearers and district team members | District | Open (temporary T-… IDs) |
| List the clubs each Assistant Governor looks after (`functionaries → ag_clubs`) | District | Ask at production (sample until then) |
| Every Past District Governor (`past_governors`), and the RI President's and DG's profiles and photos with permission to use them (`profiles`) | District | Ask at production (sample rows) |
| The email the contact form forwards to (`settings → contact_email`) and who gets the monthly clubs-not-posting list (`not_posting_emails`) | District | Open (moderators / dummy address) |
| Clubs send their public services (blood banks, eye care…) through the public service form | Clubs | Open |
| Two role titles from the team Excel contain zone names ("CDS Bareilly Zone", "CDS Kanpur Zone") | District | Kept as they are (decided 18 Oct) |
| All data in the Sheet today is sample data, the team names included; collect the correct data for production | District | Ask at production |
| Testing files (Sheet, private Sheet, forms, MemberPhotos, 3110Magazines) live in the Drive folder **3110Website-Testing**; production files go in **3110Website** | Owner of the files | Move the current files to 3110Website-Testing (open); production set-up at Release B |
| Release B before going public: test site and test Sheet, fresh production Sheet, lock on sample data, Sheet backup, build-failure email, visitor counts, broken-link check, "Start new Rotary year" | Developer + district | Open |
| Let search engines in: set the repository variable `HIDE_FROM_SEARCH` to `false` | District | Open (hidden since 17 Oct) |
| Take down the sample banner: set the repository variable `SAMPLE_DATA` to `false` once the production Sheet holds real data | District | Open (banner on since 18 Oct) |
| Real profession list (`lists` tab and `settings → professions`) | District | Open (placeholder) |
| Lawyer checks the consent form wording and privacy notice, including spouse consent | District | Open |
| Decide the photo policy for identifiable children | DG's office | Open |
| Collect clubs' website and social links through the club profile form | Clubs | Open |
| DG's office collects leaders' photo consent and photos | DG's office | Open |
| Cloudflare account under the district email for visitor statistics | District | Open |
| Buy the domain and register the site with Google Search Console | District | Open (recommended before public launch) |
| 2-step verification and recovery details on the district Google and GitHub accounts | District | Open |
| Replace the sample data with the real data (above) | District + moderators | Open |
| Name the person who forwards the Sunday bulletin message (`bulletin_emails`) | District | Open |
| Consider a district WhatsApp Channel for the weekly bulletin (one post instead of forwarding to every group) | District | Later |
