# Moderator guide

Moderators check everything before it appears on the website. Any Content moderator can approve any club's entry. Target: **within 48 hours**. If something waits longer, the moderators of that type get a reminder email at 7 am.

**Most moderators never need to open the Sheet.** They work from their email and the **moderation desk**, a simple page on the website made for phones (below). A short phone guide for each type of moderator is at `…/desk/guide/` (the **Guide** button on the desk). The Sheet and its **Rotary** menu stay for the Administrator, and for anyone who prefers them. The first time you use the **Rotary** menu, Google asks you to allow the script. That is how the Sheet records *who* approved each entry.

## The moderation desk (no Sheet needed)

**Approve from the email.** Each new activity, event, club profile update or public service sends every Content moderator an email with the title, club, text, photos, links and anything to check. It has two big buttons, **Approve** and **Reject**. They open the desk, where one more tap confirms (**Yes, approve**, or a reason for **Reject**). That extra tap is on purpose: some email programs open links by themselves to scan them, and must not approve anything. The buttons are personal to you and work for 7 days. If another moderator got there first, the desk says so ("Already approved by …").

**The desk itself** is at `…/desk/`. Open it from the **Open the moderation desk** button in any moderator email; after that, your phone remembers it.
- **Signing in:** type your email (the one in the moderators tab). You get an email with a 6-digit code and a **Sign in** button; either works for 15 minutes. You stay signed in for 7 days on that phone. **Sign out** when using someone else's phone.
- **What you see depends on your type:**

| Type | On the desk |
|---|---|
| Content | **To check**: every waiting item as a card, with photos (tap to enlarge), notes, and **Approve**, **Reject** (with ready-made reasons to tap) and **Correct** (fix spelling or remove a phone number before approving). **Recent**: approved activities of the last 30 days and coming events, with **★ Story of the month** and **Leave out of bulletin** buttons |
| Members | Consent forms and removal requests with the member's choices and photo, who sent the form and whether the member was told; **Approve** (with **"I have confirmed this with the member"** where asked) / **Remove now** / **Reject**; club changes (members joining, leaving, moving, passing away; club and district roles) beside what the members list holds; couples waiting; **Mark as deceased** (search by name, then confirm) |
| Club engagement | **Quiet clubs**: active clubs with no activity in 30 days, the last activity date and who reminded them last. **Email President and Secretary** (their emails from the private members list; sent from the district account and signed "Rotary District 3110 website team"; a hidden copy comes to you; replies go to the district account; once a week at most) or **WhatsApp** (opens WhatsApp with a ready message and the club's own form link; you choose the person) |
| District office | **Messages** from the contact form. **Reply**: type the answer and tap **Send**; it goes from the district account, signed "Rotary District 3110", so the person never sees your name or email, and the message is marked answered. Please never press Reply on the email alert. Someone who gave only a mobile number: call or WhatsApp from the **district office phone**, not your personal phone, then **Mark answered** |
| Administrator | Everything above |

- **English / हिन्दी:** the button at the top switches the desk's own words. What clubs typed stays as typed.
- **Every action is recorded:** `approved_by` on the row, as with the Rotary menu, and a line in the **moderator_log** tab (who, what, when).
- **Who can sign in:** only active rows of the moderators tab (and the district account). Setting someone's `active` to **FALSE** locks them out of the desk at once.
- **Member requests** are never approved from an email button, only on the signed-in desk. Their alert email shows just the name and club.

## Release 1: moderators keep the records up to date (18 Nov 2026)

Corrections are made on the moderation desk, not in the Sheet and not by one-off scripts. Every correction asks for
a reason and is written to the private **change_log** tab (who, when, the old and new value, why); **Recent changes**
on the desk shows them, and **Undo** puts the old values back while nobody has changed them again since. The main
Sheet's moderator_log names only the action and the row.

- **The website updates four times a day** (about 9 am, 1 pm, 6 pm and 10 pm India time), taking everything approved,
  hidden, removed or corrected since the last update. Removals and deaths also wait for the next update. **Rotary →
  Rebuild site now** stays for an emergency (within about 30 minutes).
- **Content moderators:** To check is split into **Clean** (nothing found by the checks: glance, untick anything
  wrong, **Approve the ticked**) and **Needs a look** (a card with the reason first). A District mark, a campaign count,
  photos without the consent tick, an unknown club, a possible duplicate or any other note always needs a look.
  **Hide** takes a published activity off the website with a reason; **Put back** returns it. A Content moderator
  given zones (the moderators tab's zone column, or Admin → Moderators) is emailed only about those zones' clubs.
- **Members moderators:** **Find a member** by name, RI member ID, email or mobile; **Edit** the name, RI member ID,
  club, status (also to undo a mistaken "left" or "deceased"), mobile or email. A passing away sent through the club
  changes form needs **I have confirmed this with the club** ticked before Approve (desk and Sheet sidebar).
- **Roles tab:** the daily role check's findings (Members moderators) with **Open**; **Change** who holds a role or an
  Assistant Governor's clubs and zone; **End role** (the website stops showing it, the row stays with ended_on);
  **Add an office bearer** (President, Secretary or Executive Secretary, one of each per club and year). Content
  moderators may do this for club office bearers; district roles are for Members moderators.
- **Administrators (Admin tab):** add, rename and close clubs (members move to the club it merged into, or are marked
  left); add and change moderators and their zones. Club member counts are worked out from the members list every day,
  so nobody types them.

## Release 2: four forms, and members' own updates (18 Nov 2026)

- **Club updates** form (clubs): the club's details, a member or a role (joined, left, moved, passed away, club or district
  role), or a public service, each in its own section. They arrive on the desk exactly as before (Club profile updates
  and Public services under To check; Club changes under Members). A new member's mobile and email can come with
  "joined"; approving puts them in the members list (private, never published).
- **My details on the website** form (members): show my details, remove them, or list my business. **Sent from the
  member's own email** (the one the members list has), it is applied by itself, marked `approved_by` "automatic: sent from
  the member's own email", and the member gets the usual confirmation; nothing reaches the desk. Sent by anyone else (a
  club secretary, another email), it comes to the Members moderator as before, and the member is told by email. A business listing with something to check (a phone number in the text, not found
  in the members list) also comes to the desk.
- The RI member ID is required on the My details form. A member is found by that ID, or else by the sender's own email
  when the name on the form agrees; a typed mobile number never finds anyone (anyone could type it). A form whose member
  is not found waits on the desk: find the member (Find a member) and put their RI ID on the request before approving,
  so nobody gets a second card.

## Practice round (before the website opens)

**Rotary → Administrator → Practice round: start…** (the Administrator) gives every active moderator practice items made for them on the desk, titled "Practice: …", with the same emails a real item sends and one email listing what to try:

| Type | Practice items |
|---|---|
| Content | A good activity to approve (from the email's button); one with a personal mobile number to remove with **Correct**, then approve; an event whose fee has UPI details to correct, then approve; one with no photo or link to reject |
| Members | A consent form without the declaration ticked, to reject; a search in **Mark as deceased**, without confirming |
| District office | A message with the moderator's own email as the reply address, to answer with **Reply** (it arrives in their own inbox, as the public would get it); a phone-only message to mark answered, without calling |
| Club engagement | No items: send a **WhatsApp** reminder to themselves from **Quiet clubs** (not **Email**, which really emails the club) |

A type with no moderator yet gets its practice items on the district account. Practice items have IDs starting `PRAC-` and `is_sample` TRUE: they are never published, never counted for quiet clubs or the dashboard, never sent 48-hour reminders, and approving one never changes a club or the members list. Nobody outside the moderators is emailed.

- **Practice round: report** lists, person by person, what each has done (✓) and what is still to do (✗).
- **Practice round: remove practice items…** deletes them when everyone has finished (**Clear all sample data** removes them too). The **moderator_log** keeps its record.

## Types of moderator

The **moderators** tab in the main Sheet lists who does what: one row per person and type (`type`, `name`, `email`, `active`, `from_date`, `notes`, `sheet_access`). One person may have several rows, for example Content and Club engagement. `sheet_access` TRUE gives that person the Sheet (the Access column below); FALSE or blank means the moderation desk only, which is enough for every type.

| Type | Does | Receives | Access (when sheet_access is TRUE) |
|---|---|---|---|
| **Content** | Approves or rejects activities, events, club profiles, public services and campaign reports | 48-hour reminders for those; the Saturday bulletin preview | Main Sheet |
| **Members** | Consent and removal requests, club changes, Mark as deceased | 48-hour reminders for member requests | Main Sheet and the private members Sheet |
| **Club engagement** | Follows up with quiet clubs (no activity in 30 days) | The monthly quiet-clubs list | Main Sheet |
| **District office** | Answers the public | Contact form messages; the Sunday WhatsApp message to forward | Main Sheet |
| **Administrator** | Yearly update, Upgrade Sheet, settings, sample data | (Build-failure emails, from Release B) | Main Sheet and the private members Sheet |

**When a moderator changes** (only the Sheet's owner can do this):
1. In the **moderators** tab, set the leaving person's `active` to **FALSE** (keep the row as a record), and add a row for the new person with their Google email, `active` **TRUE**, and `sheet_access` **TRUE** only if they want the Sheet.
2. **Rotary → Administrator → Apply moderators (Sheet access)…**. It lists who gets access and who loses it, and asks before changing anything. Only people listed in the tab are ever removed; the owner and anyone not in the tab are left alone. Google emails each new moderator a link to the Sheet.

**Lost phone, or a desk session in the wrong hands?** **Rotary → Administrator → Sign everyone out of the desk…** ends
every desk session at once; moderators sign in again with a new code. To lock out one person for good, set their
`active` to FALSE in the moderators tab.

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
5. Approved items appear at the next website update (about 9 am, 1 pm, 6 pm or 10 pm). For something urgent: **Rotary → Rebuild site now** (about 30 minutes).

**Linking an event to its report:** when an approved activity reports on a calendar event, type the event's ID (e.g. `EVT-2026-0004`) in the activity's `event_id` column. The calendar entry then links to the report.

**Story of the month:** set `story_of_month` to **TRUE** on the best activity of the month (judged on quality, not quantity), or use **★ Story of the month** on the desk.

**Avenue of Service, press and videos:** every new activity carries an Avenue of Service (`avenue`); correct it if it is clearly wrong. If the club says a newspaper covered it, `press_paper`, `press_date` and `press_link` hold the paper's name, the date and a link; the website shows only these, never a photo of the clipping. A note warns when there is a press link but no paper's name. `video_link` can be a YouTube, Instagram or Facebook link; YouTube videos play on the page.

**Before and after photos (17 Nov 2026):** a club may add one photo before the work and one after (`before_photo`, `after_photo`); the desk shows them as the last two photos. Check they show the same place and no people (faces of children never). Both are needed: the website shows the pair side by side under "Before and after", and one alone is not shown. If either is wrong, clear both cells before approving.

**District level (17 Nov 2026):** the activity form asks "District level?", and events have the type "District event". Both put the item first on the website and mark it "District". Check it: Yes is right when the district organised it or it was a district occasion, for example a grant inauguration or a district seminar. The Governor need not have been there. If not, set `district_level` to FALSE (or change the event type) before approving. The moderator note reminds you.

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

## Business listings (Rotary Means Business)

Members send the **Rotary Means Business** form for their own business, the topics they can speak on at club meetings, or both. New ones appear in **businesses** as pending (on the desk as "Business listing").
- **Members only.** The script looks the sender up in the members list and fills in `member_id` and `member_name`. If the note says "Not found in the members list", find the member and type their member ID in `member_id`, or reject. A listing cannot be approved for someone who is not an active member.
- A note says when the form did **not** come from the member's own email: check with the member first.
- The business needs a **trade** and a **city**. The WhatsApp number must be a mobile number; it is shown only as a WhatsApp button.
- No phone numbers or emails in the text; the website leaves such text out anyway. Light fixes (spelling, length) are fine.
- "Updates BIZ-…" means the member sent the same business again: approving replaces the older listing.
- To take a listing off: the member uses the removal form (**Business listing**), or set its status to **removed**.

## Contact messages

Messages from the website's contact form go to the private Sheet's **contact_messages** tab and are emailed to the **District office** moderators (moderators tab). **Never press Reply on that email**: it would show your own name and email. Answer on the desk instead: **Messages → Reply**, type the answer, **Send**. It goes from the district account, signed "Rotary District 3110"; the answer is kept in the `replies` column and the message is marked answered. If the person gave only a mobile number, call or WhatsApp from the district office phone, then **Mark answered** (or set `status` to **answered** in the Sheet). Messages that look like spam (more than two links, or hardly any words) are kept with status **spam** and not emailed; so are messages beyond `contact_daily_limit` in a day. The reply details are never shown on the website.

## Member requests (consent, removal and club changes)

**Rotary → Member requests (consent, removal, club changes)…** opens a panel on the right; the desk's **Members** tab shows the same.

- **Consent:** shows the member's choices, any photo, and whether the request matches someone in the private members list. Check the photo shows the member alone and is suitable. Watch for the warnings (declaration not ticked, spouse's agreement missing). Then **Approve** or **Reject**.
- **Who sent it** (the same on the desk). Each form shows the Google account it was sent from and what that account is:
  - **The member's own email** (the email on file from Rotary International): approve as usual.
  - **An office bearer of the club** (this year's President or Secretary in the **officers** tab, by their email on file): the member is emailed at their own address, told who sent the form and what it asks to show, and has **3 days** to object. Approve after that, or sooner if you have checked with the member.
  - **Not the member or a club office bearer:** the member is emailed in the same way, but you must check with the member (or their club President or Secretary), for example by phone from the district office, and tick **"I have confirmed this with the member"** before **Approve** works, even after 3 days.
  - Warnings to read: the form says *the member* but came from another email; it says *club secretary* but the sender is not an office bearer; the member ID matches but the name differs; no email on file, so nobody could tell the member. If the member sent a removal request after the form, it cannot be approved: reject it.
  - **Member:** says whether the member was emailed. If a member replies to that email to object, the reply reaches the district account: reject the form.
- **Removal:** **Remove now**. Removals must be done **within two days**; the website drops the details at its next update, and removed photos are deleted from Drive.
- **Confirmation emails:** whoever sent the form gets an email when you approve the listing (with the removal form's link), when the details are removed, or when you reject it (with your reason). Write the reason so the member can read it.
- **Club changes:** sent by anyone through the **club changes form** (`form_club_change_url` in the settings tab): a member who joined, left, moved to another club or passed away, or a club role (President, Secretary) or district role. Each shows the member ID and what was sent, and beside it what the private members list holds for that ID now ("Not in the members list" if nothing). Nothing changes until you approve. **Approve** does this:
  - *Joined:* adds the member (active, nothing shown on the website until they send the consent form) and a **club_history** row from the date joined. Someone already in another club is moved instead.
  - *Left:* sets `status` to `left` and ends their **club_history** row.
  - *Moved:* ends the old club's **club_history** row, adds the new club's and changes `club_id`. Moved to a club outside the district: marked as left.
  - *Passed away:* the same as **Mark as deceased**.
  - *Club role* or *district role:* adds a row to **officers** or **functionaries** with the name as the members list has it. The team's page and order follow the team's other rows. A role is added even if the person is not in the members list (no member card until they are). To change or remove a role later, edit the row in the Sheet.

  Then the public members list and the role check are refreshed, the website is asked to rebuild, and the sender gets an "Approved" email. **Reject** sends your reason to the sender. If the member ID, club or year is wrong, correct it on the request row in the private Sheet's **club_change_requests** tab, then approve. The members list from Rotary International stays the master list: its next refresh shows any difference.
- **Couples waiting:** anniversaries where one Rotarian spouse has not yet sent their own form, or where the two forms give different dates. Ask the club to follow up. For different dates, correct the `anniversary` in the private Sheet's **couples** tab, then set `status` to `active`.

## Professions list

The list grows as members ask. The consent form offers the professions in the **lists** tab (rows with `list` = `profession`) plus **Other**. When members choose Other and name something new, add it to the **lists** tab, then **Rotary → Update form lists**; you can also correct the member's `profession` in **members_master**.

## When a member or spouse passes away

**Rotary → Mark as deceased…** → enter their ID (from the private members list). Birthday and anniversary greetings stop **immediately** (the website follows at its next update). On the website they then have no member card and are removed from the club's member list, the directory and this year's office bearer and team lists. Their past roles and any past Member Spotlight story stay on record, showing the name only.

Someone who **leaves Rotary** is treated the same way: approve the club's club change, or set `status` to `left` in **members_master** (private Sheet), then **Rotary → Refresh public members**.

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

- **Saturday 6 pm:** each Content moderator gets an email "Tomorrow's bulletin – no action needed" with the items chosen and the WhatsApp message. Nothing to do if it looks right. To leave something out, tap **Leave this out** next to it before Sunday 6 am (then confirm on the desk). In the Sheet, the same is `bulletin_exclude` = `TRUE` on that row.
- **Sunday 8 am:** an email "This week's bulletin – please forward to the district groups" goes to the **District office** moderators. **Someone forwards that one message to the district WhatsApp groups**; WhatsApp has no free way to post into groups automatically. The email waits until the bulletin page is on the website: if the Sunday update is late, it asks for one and tries again every hour.
- Each bulletin page also has **Copy message** and **Share on WhatsApp** buttons.
- **Administrator → Send bulletin preview now / Send bulletin message now** send the two emails at any time.

## Magazine

Put the PDF into the Drive folder **3110Magazines**, named by year and month: `2026-10.pdf`. Optional cover picture with the same name: `2026-10.jpg`. The site picks it up at the next update.

## Messages from dignitaries

Type them into the **messages** tab: name, position, message, date. Tick `featured` for the District Governor's message. For a photo, upload it to Drive and paste its link in `photo`.

## Member spotlight

Each month, choose a member who ticked "member spotlight" on the consent form. In **spotlights**, add the month (`2026-11`), the member's `public_key` (from **members_public**), a headline and the story.

## Quiet clubs

A club is **quiet** when it has no activity (approved or waiting) dated in the **last 30 days**. The same rule is used in three places: the desk's **Quiet clubs** tab, the **dashboard** tab (refreshed every morning; `needs_nudge = TRUE`), and an email on the 1st of each month to the **Club engagement** moderators (until one is named, a dummy address). Send those clubs a friendly reminder from the desk's **Quiet clubs** tab: by email to the President and Secretary, or on WhatsApp, both with the club's own form link (the club already chosen). The posting guide is at `…/how-to-post/`. The Club engagement moderators decide who follows up which clubs. **Rotary → Administrator → Send clubs-not-posting email now** sends the email at any time.

## Sharing links in WhatsApp

Every page has a preview card. If you change a photo after a link was already shared, WhatsApp and Facebook may keep showing the old one for a while. Facebook's free Sharing Debugger (developers.facebook.com/tools/debug) refreshes it.

## Never

- Never type in **members_public**, **couples_public**, **dashboard** or **role_checks**: the script fills them in.
- Never put a phone number, email or bank/UPI details in a club's services or projects, an event fee, or a campaign's description or chair. The only phone numbers on the website are approved public services' own numbers and the WhatsApp buttons members agreed to.
- Never put zones on the website: they are the district's internal grouping (the `zone` columns stay in the Sheet for the district's own use).
- Never share the private members Sheet or make the Drive folders public (except 3110Magazines).
- The district never asks for money over WhatsApp. If someone reports such a message, it is a scam.
