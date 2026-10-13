# Yearly update (July) and launch checklist

## Before launch: replacing the sample data

1. In the Sheet: **Rotary → Sample data → Clear all sample data…** removes every row marked `is_sample` from both Sheets.
   This also removes the 2024-25 teams and committees loaded from the district Excel, because they were marked as sample as agreed.
2. Load the real data (paste into each tab, keeping the column order; leave `is_sample` empty):
   - **clubs**: real Rotary club IDs, names, city, zone, member count.
   - **officers**: one row per office bearer: Rotary year, club ID, member ID, name, role.
   - **functionaries**: teams and committees, one row per person per role (see the `page`, `section`, `committee`, `role`, `zone`, `term` columns).
   - **members_master** (private Sheet): the full member list, with Rotary member IDs, club, mobile, date of birth, marriage date.
   - **club_history** (private Sheet): one row per member per club, with from and to dates.
3. Update **settings → current_rotary_year**.
4. **Rotary → Update form lists** (so the forms show the real clubs).
5. **Rotary → Rebuild site now.**

## Every July (new Rotary year)

The July update **adds** rows; it never overwrites last year's, so history is kept.

1. **officers**: add the new year's office bearers with the new `rotary_year`. Leave last year's rows.
2. **functionaries**: add the new year's teams and committees with the new `rotary_year`. Last year's teams stay visible under "Past years".
3. **settings → current_rotary_year**: set the new year (e.g. `2027-28`).
4. **clubs**: update member counts; mark closed clubs `inactive` (never delete them); add new clubs.
5. **Members who moved clubs** (private Sheet): in **club_history**, put an end date on the old club row and add a new row for the new club. Change `club_id` in **members_master**.
6. **Rotary → Check roles and member IDs**: fix anything in the **role_checks** tab, so each person's new roles join their member card. Last year's roles stay on the cards under last year.
7. **Rotary → Update form lists**, then **Rotary → Rebuild site now**.

## Launch checklist (from the brief, section 12)

| Item | Who | Status |
|---|---|---|
| Named owner for the yearly update, with a backup | District | Open |
| Real names and Google emails of the four moderators (add them to the Sheet as editors and to `settings → moderator_emails`) | District | Open |
| Real Rotary club IDs | District | Open (dummy S-001…) |
| Rotary member IDs for office bearers and district team members | District | Open (temporary T-… IDs) |
| Check the club-to-zone list (`docs/data-conversion-report.md`) | District | Open |
| Real profession list (`lists` tab and `settings → professions`) | District | Open (placeholder) |
| Lawyer checks the consent form wording and privacy notice, including spouse consent | District | Open |
| Decide the photo policy for identifiable children | DG's office | Open |
| Collect clubs' website and social links through the club profile form | Clubs | Open |
| DG's office collects leaders' photo consent and photos | DG's office | Open |
| Cloudflare account under the district email for visitor statistics | District | Open |
| Buy the domain and register the site with Google Search Console | District | Open (recommended before public launch) |
| 2-step verification and recovery details on the district Google and GitHub accounts | District | Open |
| Replace the sample data with the real data (above) | District + moderators | Open |
