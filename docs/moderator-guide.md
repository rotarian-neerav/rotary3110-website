# Moderator guide

Moderators check everything before it appears on the website. Any Content moderator can approve any club's entry. Target: **within 48 hours**. If something waits longer, the moderators of that type get a reminder email at 7 am.

The first time you use the **Rotary** menu, Google asks you to allow the script. That is how the Sheet records *who* approved each entry.

## Types of moderator

The **moderators** tab in the main Sheet lists who does what: one row per person and type (`type`, `name`, `email`, `active`, `from_date`, `notes`). One person may have several rows, for example Content and Club engagement.

| Type | Does | Receives | Access |
|---|---|---|---|
| **Content** | Approves or rejects activities, events, club profiles, public services and campaign reports | 48-hour reminders for those; the Saturday bulletin preview | Main Sheet |
| **Members** | Consent and removal requests, Mark as deceased | 48-hour reminders for member requests | Main Sheet and the private members Sheet |
| **Club engagement** | Follows up with clubs that are not posting | The monthly clubs-not-posting list | Main Sheet |
| **District office** | Answers the public | Contact form messages; the Sunday WhatsApp message to forward | Main Sheet |
| **Administrator** | Yearly update, Upgrade Sheet, settings, sample data | (Build-failure emails, from Release B) | Main Sheet and the private members Sheet |

**When a moderator changes** (only the Sheet's owner can do this):
1. In the **moderators** tab, set the leaving person's `active` to **FALSE** (keep the row as a record), and add a row for the new person with their Google email and `active` **TRUE**.
2. **Rotary → Administrator → Apply moderators (Sheet access)…**. It lists who gets access and who loses it, and asks before changing anything. Only people listed in the tab are ever removed; the owner and anyone not in the tab are left alone. Google emails each new moderator a link to the Sheet.

Until a type has a real email, its emails go where they went before: the older settings (`contact_email`, `bulletin_emails`, `not_posting_emails`), then the Content moderators, then `moderator_emails`, then the district account. The placeholder rows (Moderator A–D, District office, Website administrator) are ignored until an email is filled in.

## Activities and events

1. Open the **activities** (or **events**) tab. New entries have status **pending**. Read the `moderator_note` column: it warns about possible duplicates, missing photos or future dates.
2. Check the entry:
   - **Light fixes only:** spelling, trimming length. Edit the cell directly. Do not rewrite the club's story; the original is kept in the `raw_activity_form` tab.
   - Open any **link** the club gave and check it really is the club's own post.
   - Look at the **photos** (the `photo_files` column lists them; they are in your Drive under the form's upload folder). No children's names in the text.
   - **Photos arrive with consent:** the sender ticks *"Everyone identifiable in these photos agreed to them being published, and for children, a parent or guardian agreed."* (`photo_consent`). Reject photos without that tick.
   - Every activity needs **at least one photo or a link** to the club's post.
3. Click any cell in the row (or select several rows) → **Rotary → ✔ Approve selected row(s)**. The script fills in `approved_by` and `approved_at` and emails the club.
4. To refuse: **Rotary → ✖ Reject selected row(s)…** and type the reason. The club gets the reason by email.
5. Approved items appear at the next update (**every Sunday**). For something urgent: **Rotary → Rebuild site now** (about 30 minutes).

**Linking an event to its report:** when an approved activity reports on a calendar event, type the event's ID (e.g. `EVT-2026-0004`) in the activity's `event_id` column. The calendar entry then links to the report.

**Story of the month:** tick `story_of_month` on the best activity of the month (judged on quality, not quantity).

**Avenue of Service, press and videos:** every new activity carries an Avenue of Service (`avenue`); correct it if it is clearly wrong. If the club says a newspaper covered it, `press_paper`, `press_date` and `press_link` hold the paper's name, the date and a link; the website shows only these, never a photo of the clipping. A note warns when there is a press link but no paper's name. `video_link` can be a YouTube, Instagram or Facebook link; YouTube videos play on the page.

**Open to everyone:** `open_to_all` (TRUE/FALSE) on an event marks it "Open to everyone" on the website. Club events open to all are marked anyway.

**Event registration:** clubs can give a closing date and a fee on the form. The website works out the registration line by itself ("Registration open till 20 Oct", then "Registration closed"). Use the `registration_status` column only for exceptions:
- **Seats full**, **Postponed** or **Cancelled**: shown instead of the dates. A cancelled event stays listed with "Cancelled", so people who saw the poster find out; phone calendars that saved it are told too.
- **Extended**: also change `registration_close_date` to the new date.

A fee is shown as typed ("₹500 per person", "Free"). If the moderator note says the fee contains payment details (UPI, IFSC, a bank account or a phone number), remove them before approving; the website leaves such a fee out anyway.

## Club profile updates

New ones appear in **club_profile_requests**. Check that the links work and belong to the club, then approve. The links are copied to the club's row in **clubs**.

### Regular services and permanent projects

Clubs list them on the club profile form, one per line:
- **Regular services**: what – when – where, for example `Free eye check-up – every Thursday, 11 am–1 pm – Roshni Centre, Civil Lines`.
- **Permanent projects**: name – what it is – where, for example `Rotary Eye Hospital – eye hospital under construction – Kasganj`.

Clubs can also give their **meeting day** (a weekday). When approved it goes into the club's `meeting_day`, which the Clubs page uses for its "Meets on" filter. Until a club answers, the day is read from its meeting text ("Every Thursday…").

When approved, the club's list is **replaced** by the new one. A blank answer leaves the list as it is; "none" clears it. Read the moderator note: a line with a phone number or email must be removed before approving (the website leaves such a line out anyway), and lines over 160 characters are cut. You can also make light fixes in the `permanent_projects` and `regular_services` cells of the **clubs** tab.

## Public services (blood banks, eye care, dialysis…)

Clubs send one **Public service run by a club** form per facility. New ones appear in **public_services** as pending.
- Check that the facility exists and that the club runs or supports it.
- The **phone number must be the facility's own** (reception or helpline), never a member's personal mobile. A moderator note warns when the number is a mobile; check it before approving. A number that is not a plain number cannot be approved until it is corrected.
- Approve or reject with the Rotary menu, as for activities. Approved services appear on the **Services you can use** page, the club's page and the city's page, with a tap-to-call number and the map link.
- Text with a phone number or email in the name, timings, address or description is left off the website.

## Contact messages

Messages from the website's contact form go to the private Sheet's **contact_messages** tab and are emailed to the **District office** moderators (moderators tab). Reply to the person directly, then set `status` to **answered**. Messages that look like spam (more than two links, or hardly any words) are kept with status **spam** and not emailed; so are messages beyond `contact_daily_limit` in a day. The reply details are never shown on the website.

## Member requests (consent and removal)

**Rotary → Member requests (consent & removal)…** opens a panel on the right.

- **Consent:** shows the member's choices, any photo, and whether the request matches someone in the private members list. Check the photo shows the member alone and is suitable. Watch for the warnings (declaration not ticked, spouse's agreement missing). Then **Approve** or **Reject**.
- **Removal:** **Remove now**. Removals must be done **within two days**; the site updates within about 30 minutes, and removed photos are deleted from Drive.
- **Confirmation emails:** whoever sent the form gets an email when you approve the listing (with the removal form's link), when the details are removed, or when you reject it (with your reason). Write the reason so the member can read it.
- **Couples waiting:** anniversaries where one Rotarian spouse has not yet sent their own form, or where the two forms give different dates. Ask the club to follow up. For different dates, correct the `anniversary` in the private Sheet's **couples** tab, then set `status` to `active`.

## Professions list

The list grows as members ask. The consent form offers the professions in the **lists** tab (rows with `list` = `profession`) plus **Other**. When members choose Other and name something new, add it to the **lists** tab, then **Rotary → Update form lists**; you can also correct the member's `profession` in **members_master**.

## When a member or spouse passes away

**Rotary → Mark as deceased…** → enter their ID (from the private members list). Birthday and anniversary greetings stop **immediately** (the site rebuilds within about 30 minutes). On the website they then have no member card and are removed from the club's member list, the directory and this year's office bearer and team lists. Their past roles and any past Member Spotlight story stay on record, showing the name only.

Someone who **leaves Rotary** is treated the same way: set `status` to `left` in **members_master** (private Sheet), then **Rotary → Refresh public members**.

If they held a role this year, enter who holds it now in **officers** or **functionaries**. **Check roles and member IDs** (below) lists these.

## Member cards and member IDs

Every office bearer and district team member has a **member card** on the website, with all their roles, newest year first. Members who agreed through the consent form also show their profession, photo and contact. The cards join up by **member ID**, so the ID must be the same in **officers**, **functionaries** and the private **members_master**.

**Rotary → Check roles and member IDs** (also run every morning) lists what to fix in the **role_checks** tab, most urgent first:
- someone marked deceased or left who still holds a role this year;
- a role with no member ID (no card);
- the same ID with different names, or the same name and club with different IDs (one person, two cards);
- an ID that is not in the members list, or whose name differs.

Titles do not matter: "DG", "PDG", "Rtn" are ignored when comparing names.

## District campaigns

Each Rotary year the Governor runs a few district-wide drives (blood donation, school health check-ups and so on). Clubs report their part through the ordinary activity form: they choose the campaign and give a count. The website adds up the counts and shows a page for each campaign, a band on the home page while it runs, and a line in the weekly bulletin.

**Adding a campaign** (at the start of the year, or whenever one begins): add a row to the **campaigns** tab:

| Column | What to type |
|---|---|
| `campaign_id` | A short id that never changes, e.g. `BLOOD-2026-27` |
| `rotary_year` | e.g. `2026-27` |
| `name` | e.g. `Blood Donation Drive` |
| `unit` | What the count measures, plural: `blood units`, `students screened` |
| `start_date`, `end_date` | Only work done between these dates counts |
| `target` | Optional whole number; shows a progress bar |
| `description` | Optional, 1–3 lines |
| `chair`, `chair_member_id` | Optional: the chair's name and role, and their member ID so the name links to their member card. No contact details. |
| `sort_order` | Optional number |

Then **Rotary → Update form lists**, so the campaign appears on the activity form. The form keeps offering it until 30 days after `end_date`, for late reports; it drops off by itself after that.

**Checking reports:** the moderator note warns about a count without a campaign, a date outside the campaign, a count above `campaign_check_above` (settings tab, 1000 to start with), and another club reporting the same campaign on the same date (it may be one joint event counted twice). You can correct `campaign_id` or `campaign_count` before approving. A joint activity counts only for the club that sent it. Only approved reports count, and only the website's running total is shown: never call it "live".

## Weekly bulletin

Every Sunday the website puts together **"This week in District 3110"** (`…/bulletin/`) from approved data: events in the next 14 days (district events first), registrations closing that week, up to 6 activities approved in the past week (one per club), and campaign totals. Nobody writes it. Past weeks stay at their own address (`…/bulletin/2026-10-18/`).

- **Saturday 6 pm:** the Content moderators get an email "Tomorrow's bulletin – no action needed" with the WhatsApp message and the row ids chosen. Nothing to do if it looks right. To leave something out, set `bulletin_exclude` to `TRUE` on that row in the **activities** or **events** tab before Sunday 6 am.
- **Sunday 8 am:** an email "This week's bulletin – please forward to the district groups" goes to the **District office** moderators. **Someone forwards that one message to the district WhatsApp groups**; WhatsApp has no free way to post into groups automatically. The email waits until the bulletin page is on the website: if the Sunday update is late, it asks for one and tries again every hour.
- Each bulletin page also has **Copy message** and **Share on WhatsApp** buttons.
- **Administrator → Send bulletin preview now / Send bulletin message now** send the two emails at any time.

## Magazine

Put the PDF into the Drive folder **3110Magazines**, named by year and month: `2026-10.pdf`. Optional cover picture with the same name: `2026-10.jpg`. The site picks it up at the next update.

## Messages from dignitaries

Type them into the **messages** tab: name, position, message, date. Tick `featured` for the District Governor's message. For a photo, upload it to Drive and paste its link in `photo`.

## Member spotlight

Each month, choose a member who ticked "member spotlight" on the consent form. In **spotlights**, add the month (`2026-11`), the member's `public_key` (from **members_public**), a headline and the story.

## Once a month: nudge quiet clubs

On the 1st of each month, an email lists the clubs with no activity dated in the month just ended (to the **Club engagement** moderators; until one is named, a dummy address). The **dashboard** tab (refreshed every morning) shows the same, live: `needs_nudge = TRUE` means no activity this month. Send those clubs a friendly reminder with their own form link (the clubs tab's `activity_form_link`, with the club already chosen) and the posting guide (`…/how-to-post/`). The Club engagement moderators decide who follows up which clubs. **Rotary → Administrator → Send clubs-not-posting email now** sends the email at any time.

## Sharing links in WhatsApp

Every page has a preview card. If you change a photo after a link was already shared, WhatsApp and Facebook may keep showing the old one for a while. Facebook's free Sharing Debugger (developers.facebook.com/tools/debug) refreshes it.

## Never

- Never type in **members_public**, **couples_public**, **dashboard** or **role_checks**: the script fills them in.
- Never put a phone number, email or bank/UPI details in a club's services or projects, an event fee, or a campaign's description or chair. The only phone numbers on the website are approved public services' own numbers and the WhatsApp buttons members agreed to.
- Never put zones on the website: they are the district's internal grouping (the `zone` columns stay in the Sheet for the district's own use).
- Never share the private members Sheet or make the Drive folders public (except 3110Magazines).
- The district never asks for money over WhatsApp. If someone reports such a message, it is a scam.
