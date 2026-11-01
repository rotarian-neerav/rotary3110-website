# Google setup (about 30 minutes, once)

Do this **signed in to Google as rotarian.neerav@gmail.com**, on a computer (not a phone).
You will need two files from this project: `dist/apps-script/Code.gs` and `dist/apps-script/Sidebar.html`.

## 1. Put the script into the Sheet (3 minutes)

1. Open the Sheet **3110Website**.
2. Menu **Extensions → Apps Script**. A new tab opens with a file called `Code.gs`.
3. Select everything in `Code.gs` and delete it. Open `dist/apps-script/Code.gs` from this project, copy **all** of it, and paste it in.
4. Click **+** next to "Files" → **HTML** → name it exactly `Sidebar` (Google adds `.html`). Delete what is in it, then paste the whole of `dist/apps-script/Sidebar.html`.
5. Click the **gear icon (Project Settings)** → set **Time zone** to *(GMT+05:30) India Standard Time*.
   Further down, under **Script properties**, click **Add script property** twice and add:
   - `PRIVATE_SHEET_ID`: the private members Sheet's ID (in its address, the long part between `/d/` and `/edit`);
   - `MAGAZINE_FOLDER_ID`: the magazine folder's ID (in its address, the long part after `/folders/`).
   Then **Save script properties**. They are kept here, not in the code, because the code is public.
6. Back in the editor (the `< >` icon), click the **save** icon.

## 2. Run the setup (3 minutes)

1. At the top of the editor, choose the function **`setup`** in the drop-down, then click **Run**.
2. Google asks for permission. Click **Review permissions** → choose **rotarian.neerav@gmail.com**.
3. You will see **"Google hasn't verified this app"**. That is normal for a script you wrote yourself. Click **Advanced → Go to (project name) (unsafe)** → **Allow**.
   The script asks to manage your spreadsheets, forms and Drive files, send email as you (for moderator reminders and replies to clubs), and connect to an external service (to download the sample data from GitHub).
4. Wait about a minute. The log at the bottom says **Setup finished** and lists what it did:
   tabs in both Sheets, sample data loaded, six forms created (activity, club profile, public service, consent, removal and the website's contact form) and moved into the folder that holds the Sheet, sharing checked, daily reminders scheduled.
5. Go back to the Sheet and reload the page. A **Rotary** menu appears.

## 3. Add the four photo questions by hand (5 minutes)

Google does not let a script add file-upload questions, so these four are added by hand. **The titles must match exactly** (copy them from here).

The forms are in the same folder as the Sheet (testing: **3110Website-Testing**; production: **3110Website**), or open them from the Sheet's **settings** tab (`form_…_url`; change `viewform` to `edit` in the address).

| Form | Add after the question… | Title (copy exactly) | Settings |
|---|---|---|---|
| Club activity or event | **Description** (activity page) | `Photos (up to 3, each under 1 MB)` | File upload · Allow only specific file types: **Image** · Maximum number of files: **3** · Maximum file size: **1 MB** · not required |
| Club activity or event | **Short description (optional)** (event page) | `Photos (up to 3, each under 1 MB)` | File upload · **Image** · **3** files · **1 MB** · not required |
| Member consent | **Show my photo next to my name** | `My photo (one photo of me alone, under 1 MB)` | File upload · **Image** · **1** file · **1 MB** · not required |
| Member consent | **Our wedding anniversary** | `Couple photo (optional, under 1 MB)` | File upload · **Image** · **1** file · **1 MB** · not required |

How to add one: open the form → click the question named in the middle column → click **⊕ (Add question)** in the floating toolbar → change the type to **File upload** → Google asks to confirm that respondents will sign in and files go to your Drive → **Continue** → paste the title and set the options above.

For the activity form, also put this in the photo question's description: *Photos must be under 1 MB. Easy way: send the photo to yourself on WhatsApp, save it, then upload that copy.*

## 4. Publish the data link (3 minutes)

1. In the Apps Script editor, click **Deploy → New deployment**.
2. Click the gear next to "Select type" → **Web app**.
3. Description: `Website data link`. **Execute as: Me (rotarian.neerav@gmail.com)**. **Who has access: Anyone**.
   ("Anyone" is needed so the website build can reach it. Without the secret token it returns nothing.)
4. Click **Deploy** → copy the **Web app URL** (ends in `/exec`).
5. In the Sheet: **Rotary → Administrator → Show data link details** shows the address and the **token**.

## 5. Connect it to the website

Either send the two values (web app URL and token) to the person who set up the website, or add them yourself on GitHub:
repository **rotary3110-website → Settings → Secrets and variables → Actions → New repository secret**:
`DATA_URL` = the web app URL, `DATA_TOKEN` = the token.

Then **Actions → Build and publish → Run workflow**. In about 3 minutes the website shows the data from the Sheet.

## If you change the script later

Paste the new `Code.gs`, save, then **Deploy → Manage deployments → ✏ (edit) → Version: New version → Deploy**. The web app address stays the same.

Then reload the Sheet and run **Rotary → Administrator → Upgrade Sheet (new tabs, columns, questions)**. It adds anything the new script needs and is safe to run more than once: new tabs and columns (at the end, never moving existing ones), settings, dropdowns, new form questions (added to the existing forms in their place, so the form links stay the same), and timed emails. It shows a list of what it changed.

The October 2026 upgrade adds:
- the **campaigns** tab; new columns in **clubs**, **club_profile_requests**, **activities** and **events**;
- settings `campaign_check_above`, `bulletin_start_date` and `bulletin_emails`;
- questions *Permanent projects*, *Regular services* (club profile form), *District campaign*, *Campaign count*, *Registration closes on* and *Fee* (activity and event form);
- the bulletin emails on Saturday 6 pm and Sunday 8 am.

The **Release A** upgrade (17 October 2026) adds:
- two new forms: **Public service run by a club** (answers in the main Sheet's `public_services` tab) and **Contact Rotary District 3110** (shown inside the website's Contact page; answers in the private Sheet's `contact_messages` tab). Neither needs a photo question. The contact form asks for no Google sign-in, so anyone can write;
- the tabs **public_services**, **profiles** and **past_governors** (main Sheet) and **contact_messages** (private Sheet); new columns at the end of **clubs** (`meeting_day`, `activity_form_link`), **functionaries** (`ag_clubs`), **activities** (`avenue`, `video_link`, `press_paper`, `press_date`, `press_link`), **events** (`open_to_all`) and **club_profile_requests** (`meeting_day`);
- settings `form_public_service_url`, `form_contact_url`, `contact_email` (where contact messages are emailed; blank = the moderators), `contact_daily_limit` (20) and `not_posting_emails` (a dummy address until the district names someone);
- questions *Avenue of Service* (required), *Video link*, three *Covered in the press* questions and *Open to everyone?* (activity and event form), and *Meeting day* (club profile form). The activity form's description now links to the posting guide;
- each club's own activity-form link with the club already chosen, in the clubs tab's `activity_form_link` column (refreshed with the form lists; never published);
- the monthly clubs-not-posting email on the 1st at 9 am.

The **18 October** upgrade adds:
- the **moderators** tab (main Sheet, never sent to the website) with placeholder rows, one per type of moderator (see the moderator guide);
- **Rotary → Administrator → Apply moderators (Sheet access)…**;
- confirmation emails to whoever sent a consent or removal form;
- clearer photo consent wording on the activity form (children: a parent or guardian agreed);
- new notes on the older settings `moderator_emails`, `contact_email`, `bulletin_emails` and `not_posting_emails`: they are used only while the moderators tab names no one of that type.

The **18 October (desk)** upgrade adds the moderation desk (section 7):
- the **moderator_log** tab (main Sheet, filled in by the script, never sent to the website);
- an email to the Content moderators for each new activity, event, club profile update and public service, with personal **Approve** and **Reject** buttons; an email to the Members moderators for each new consent or removal form;
- **Leave this out** buttons in the Saturday bulletin preview; desk links in the 48-hour reminders and the monthly clubs-not-posting email;
- contact messages are answered from the desk (**Messages → Reply**): the answer goes from the district account, signed "Rotary District 3110", so the moderator's name and email stay private; the replies are kept in a new **replies** column of **contact_messages**;
- a **sheet_access** column (TRUE/FALSE) in the **moderators** tab: Sheet access is now chosen per person;
- a newspaper name that is really a web address is moved to the newspaper link, with a note.

The **19 October** version (installed in the test Sheet on 19 Oct) needs only paste `Code.gs` and **Deploy → Manage deployments → edit → New version** (no Upgrade Sheet, no new columns). It adds:
- **Rotary → Administrator → Practice round: start… / report / remove practice items…** (see the moderator guide);
- automatic retries when Google is briefly slow ("Service … timed out"), and **Apply moderators** lists anyone it could not finish.

The **19 October (evening)** version (installed in the test Sheet on 19 Oct) also needs only paste `Code.gs` and **Deploy → Manage deployments → edit → New version**. It puts quiet clubs on one rule: no activity in the last 30 days, for the desk's Quiet clubs, the dashboard's `needs_nudge` and the monthly email (which listed the clubs with nothing in the month just ended). The email's subject is now "Clubs with no activity in the last 30 days".

The **29 October** version: paste `Code.gs`, **Deploy → Manage deployments → edit → New version**, then **Administrator → Upgrade Sheet** (it adds the private `gender` column to members_master). It also adds **Administrator → Reset for production (once)…**, used a single time before the real data is imported (see the yearly update and launch guide).

The **1 November** version keeps form answers as plain text (an answer starting with `=` could otherwise become
a formula), gives the moderation desk the fingerprint it checks links against, and reads the private Sheet's and the
magazine folder's IDs from the script properties. **Before** pasting it: in the editor, find `PRIVATE_SHEET_ID:` and
`MAGAZINE_FOLDER_ID:` near the top of the old `Code.gs` and add both, with the same values (without the quotes), under
**Project Settings → Script properties** (see step 5 of part 1). Then paste `Code.gs`, **Deploy → Manage
deployments → edit → New version**, and **Rotary → Rebuild site now**. Without the two properties the data link
answers "add the script property …" and the build stops, leaving the website as it was.

## 6. Name the moderators

1. Open the **moderators** tab (main Sheet). Each row is one person in one type: **Content**, **Members**, **Club engagement**, **District office** or **Administrator**. Put the real name and Google email over a placeholder, and keep `active` = **TRUE**. Add rows for more people (one person can have several rows).
   - The **District office** row is where contact form messages are emailed (this replaces the older `contact_email` setting in the **settings** tab) and who gets the Sunday WhatsApp message.
   - **Club engagement** gets the monthly list of quiet clubs (no activity in the last 30 days).
2. Set `sheet_access` to **TRUE** only for people who want to work in the Sheet; leave it **FALSE** (or blank) for those who use only the moderation desk, which needs no Sheet access. The Administrator placeholder starts as TRUE.
3. **Rotary → Administrator → Apply moderators (Sheet access)…** (as the Sheet's owner): it shows who will get access to the Sheet (and, for Members and Administrator rows, the private members Sheet) and asks before doing it.
4. When someone stops, set their `active` to **FALSE** and run **Apply moderators** again. Setting `sheet_access` to FALSE and running it removes only the Sheet; the person stays on the desk and keeps getting their emails.

After the upgrade, existing rows have a blank `sheet_access`, which counts as FALSE: set TRUE for anyone who should keep the Sheet before running **Apply moderators**, which lists every removal and asks first.

## 7. The moderation desk

The desk (`…/desk/` on the website) lets moderators approve, reject and follow up from their phone without opening the Sheet. It needs the **18 October (desk)** script:

1. Paste the new `Code.gs`, save, then **Deploy → Manage deployments → ✏ → Version: New version → Deploy**. This step matters: the desk talks to the new version. The address stays the same.
2. Reload the Sheet and run **Administrator → Upgrade Sheet**. It adds the **moderator_log** tab.
3. Press **Rotary → Rebuild site now** (or wait for the next update). When the website build next reads the data link, the script remembers its own web address, which the desk's email links need. Until then, emails say "open the Sheet" instead of showing desk buttons.
4. Put a real email on at least one moderators row (your own is fine for a test), then open `…/desk/` from the **Open the moderation desk** button in the next moderator email, and sign in with the emailed code.

The desk page on the website holds no data and no addresses. Everything comes from the script after signing in. The script's web address travels only after the `#` in the links emailed to moderators, and the page remembers it on that phone. The web app never serves a page itself, so no web page can run the script's other functions.
