# Moderator guide

Four moderators check everything before it appears on the website. Any moderator can approve any club's entry. Target: **within 48 hours**. If something waits longer, all moderators get a reminder email at 7 am.

You need edit access to the Sheet **3110Website** (and to the private members Sheet for member requests). The first time you use the **Rotary** menu, Google asks you to allow the script. That is how the Sheet records *who* approved each entry.

## Activities and events

1. Open the **activities** (or **events**) tab. New entries have status **pending**. Read the `moderator_note` column: it warns about possible duplicates, missing photos or future dates.
2. Check the entry:
   - **Light fixes only:** spelling, trimming length. Edit the cell directly. Do not rewrite the club's story; the original is kept in the `raw_activity_form` tab.
   - Open any **link** the club gave and check it really is the club's own post.
   - Look at the **photos** (the `photo_files` column lists them; they are in your Drive under the form's upload folder). No children's names in the text.
   - Every activity needs **at least one photo or a link** to the club's post.
3. Click any cell in the row (or select several rows) → **Rotary → ✔ Approve selected row(s)**. The script fills in `approved_by` and `approved_at` and emails the club.
4. To refuse: **Rotary → ✖ Reject selected row(s)…** and type the reason. The club gets the reason by email.
5. Approved items appear at the next update (**every Sunday**). For something urgent: **Rotary → Rebuild site now** (about 15 minutes).

**Linking an event to its report:** when an approved activity reports on a calendar event, type the event's ID (e.g. `EVT-2026-0004`) in the activity's `event_id` column. The calendar entry then links to the report.

**Story of the month:** tick `story_of_month` on the best activity of the month (judged on quality, not quantity).

## Club profile updates

New ones appear in **club_profile_requests**. Check that the links work and belong to the club, then approve. The links are copied to the club's row in **clubs**.

## Member requests (consent and removal)

**Rotary → Member requests (consent & removal)…** opens a panel on the right.

- **Consent:** shows the member's choices, any photo, and whether the request matches someone in the private members list. Check the photo shows the member alone and is suitable. Watch for the warnings (declaration not ticked, spouse's agreement missing). Then **Approve** or **Reject**.
- **Removal:** **Remove now**. Removals must be done **within two days**; the site updates within about 15 minutes, and removed photos are deleted from Drive.
- **Couples waiting:** anniversaries where one Rotarian spouse has not yet sent their own form, or where the two forms give different dates. Ask the club to follow up. For different dates, correct the `anniversary` in the private Sheet's **couples** tab, then set `status` to `active`.

## When a member or spouse passes away

**Rotary → Mark as deceased…** → enter their ID (from the private members list). Birthday and anniversary greetings stop **immediately** (the site rebuilds within 15 minutes). Their past roles stay on record.

## Magazine

Put the PDF into the Drive folder **3110Magazines**, named by year and month: `2026-10.pdf`. Optional cover picture with the same name: `2026-10.jpg`. The site picks it up at the next update.

## Messages from dignitaries

Type them into the **messages** tab: name, position, message, date. Tick `featured` for the District Governor's message. For a photo, upload it to Drive and paste its link in `photo`.

## Member spotlight

Each month, choose a member who ticked "member spotlight" on the consent form. In **spotlights**, add the month (`2026-11`), the member's `public_key` (from **members_public**), a headline and the story.

## Once a month: nudge quiet clubs

Open the **dashboard** tab (refreshed every morning). `needs_nudge = TRUE` means no activity this month. Send those clubs a friendly reminder in the WhatsApp group with the form link: `…/submit/`. Moderators take turns each month.

## Sharing links in WhatsApp

Every page has a preview card. If you change a photo after a link was already shared, WhatsApp and Facebook may keep showing the old one for a while. Facebook's free Sharing Debugger (developers.facebook.com/tools/debug) refreshes it.

## Never

- Never type in **members_public**, **couples_public** or **dashboard**: the script fills them in.
- Never share the private members Sheet or make the Drive folders public (except 3110Magazines).
- The district never asks for money over WhatsApp. If someone reports such a message, it is a scam.
