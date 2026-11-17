# Yearly update (July) and what is left from the launch

## Every July (new Rotary year)

The July update **adds** rows; it never overwrites last year's, so history is kept.

1. **officers**: add the new year's office bearers with the new `rotary_year`. Leave last year's rows.
2. **functionaries**: add the new year's teams and committees with the new `rotary_year`. Last year's teams stay visible under "Past years".
3. **Rotary → Administrator → Start new Rotary year…** (after steps 1 and 2): it moves **settings → current_rotary_year** on by one year, adds the governor who has just finished to **past_governors**, runs the role check and the form lists, asks for a rebuild, and lists what is left (steps 4, 7 and 8). It refuses while the new year has no office bearers or team rows.
4. **clubs**: update member counts; mark closed clubs `inactive` (never delete them); add new clubs.
5. **Members who moved clubs** (private Sheet): in **club_history**, put an end date on the old club row and add a new row for the new club. Change `club_id` in **members_master**.
6. **Rotary → Check roles and member IDs**: fix anything in the **role_checks** tab, so each person's new roles join their member card. Last year's roles stay on the cards under last year.
7. **campaigns**: add the new year's district campaigns (see the moderator guide). Last year's campaign pages stay, under last year.
8. **past_governors**: check the governor who has just finished was added (step 3 does it). **profiles**: add the new District Governor (the newest row is shown). **functionaries**: fill in `ag_clubs` for the new Assistant Governors.
9. **Rotary → Update form lists** (this also renews each club's own form link), then **Rotary → Rebuild site now**.

## Left from the launch checklist

The website went public on 16 November 2026. Everything else on the launch checklist (brief, section 12) was done by
then; the full list is in this file's history on GitHub.

| Item | Who | Status |
|---|---|---|
| Named owner for the yearly update, with a backup | District | Open |
| Practice round: **Administrator → Practice round: start…**; each moderator works through their practice items (guide at `…/desk/guide/`); check **Practice round: report**, then **remove practice items** | Administrator + moderators | Installed; to try |
| Clubs send their public services (blood banks, eye care…) through the public service form | Clubs | Open |
| Clubs send their website and social links, and their meeting day, through the club profile form | Clubs | Open |
| Profession list (`lists` tab): an evolving list; moderators add professions as members ask | Moderators | Ongoing |
| Release B, the rest: visitor counts (a Cloudflare account under the district email), an outside-link check, a test Sheet | District + developer | Not yet decided |
| Register the site with Google Search Console | District | Deferred |
| 2-step verification and recovery details on the district Google and GitHub accounts | District | Open |
| A district WhatsApp Channel for the weekly bulletin (one post instead of forwarding to every group) | District | Later |
