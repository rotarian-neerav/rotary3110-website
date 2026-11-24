# Yearly update (July) and open district items

## Every July (new Rotary year)

The website works out the Rotary year from the date (India time), so it moves on by itself on 1 July: next year's
office bearers and team become this year's, the "Elect" titles drop, and the Governor who has just finished becomes a
Past District Governor. Nothing needs to be moved by hand. The July update **adds** rows; it never overwrites last
year's, so history is kept. Next year's team can be added any time before July; the website shows it at once, as
"Elect" (owner, 24 Nov 2026).

0. **1 July: start a build.** On GitHub, **Actions → Build and publish → Run workflow** (the owner does this), so the
   website changes year that morning instead of at the next scheduled build.
1. **officers**: add the new year's office bearers with the new `rotary_year`. Leave last year's rows. The easiest
   way for many clubs at once: the **Team lists** Sheet, tab Club office bearers, checked and imported on the desk
   (Roles → Team lists; see the moderator guide). Clubs may already
   have reported theirs through Club updates (members and roles) or a moderator added them on the desk; those count from
   1 July by themselves. A club whose new office bearers are not in yet keeps its last known ones acting (who may send
   for the club, who gets the weekly club email) until they are, so nothing stops on 1 July.
2. **functionaries**: add the new year's teams and committees with the new `rotary_year`, best through the **Team
   lists** Sheet, tab District team, checked and imported on the desk, any time before July. Every year stays on the
   Leadership and Teams pages, chosen from the **Rotary year** drop-down. The coming Governors are added through Club
   updates (a district role, team "Governor line", role "District Governor", the year they hold office, up to three
   years ahead); the website calls them Elect, Nominee and Nominee Designate by itself.
4. **Clubs** (desk, Admin → Clubs): add new clubs, close the ones that closed (their members move or are marked left). Member counts are worked out from the members list every day; nobody types them.
5. **Members who moved clubs**: the old club sends "left" and the new club "joined" on the Club updates form (members and roles, `/club-changes/`); the "joined" is approved once the "left" is in. Or a Members moderator uses **Find a member → Edit** on the desk. The club history follows by itself, and an office bearer who moved no longer counts for the old club.
6. **Roles to check** (desk, Roles tab): fix what the daily role check found, so each person's new roles join their member card. Last year's roles stay on the cards under last year.
6a. **Moderators** (desk, Admin → Moderators): the new year's zone moderators in, with their zones; those who stepped down set to inactive. Nobody can take themselves off, so an Administrator does it.
7. **campaigns**: add the new year's district campaigns (see the moderator guide). Last year's campaign pages stay, under last year.
8. **past_governors**: nothing to add for 2024-25 onward: the website takes those Past District Governors from the
   Governor line. Older ones missing from the tab can be added there. **profiles**: add the new District Governor with
   the new `rotary_year` (only this year's profile is shown). The new Assistant Governors' clubs and zone: desk, Roles
   tab → **Change**.
9. **Rotary → Update form lists** (this also renews each club's own form link), then **Rotary → Rebuild site now**.

## Left from the launch checklist

The website went public on 16 November 2026. Everything else on the launch checklist (brief, section 12) was done by
then; the full list is in this file's history on GitHub.

| Item | Who | Status |
|---|---|---|
| Named owner for the yearly update, with a backup | District | Open |
| Practice round: **Administrator → Practice round: start…**; each moderator works through their practice items (guide at `…/desk/guide/`); check **Practice round: report**, then **remove practice items** | Administrator + moderators | Installed; to try |
| Clubs send their public services (blood banks, eye care…) through the Club updates form (public service section, `/public-service/`) | Clubs | Open |
| Clubs send their website and social links, and their meeting day, through the Club updates form (club details section, `/club-profile/`) | Clubs | Open |
| Profession list (`lists` tab): an evolving list; moderators add professions as members ask | Moderators | Ongoing |
| Release B, the rest: visitor counts (a Cloudflare account under the district email), an outside-link check, a test Sheet | District + developer | Not yet decided |
| Register the site with Google Search Console | District | Deferred |
| 2-step verification and recovery details on the district Google and GitHub accounts | District | Open |
| A district WhatsApp Channel for the weekly bulletin (one post instead of forwarding to every group) | District | Later |
