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
   tabs in both Sheets, sample data loaded, four forms created (activity, **Club updates**, **My details on the website** and the website's contact form) and moved into the folder that holds the Sheet, sharing checked, daily reminders scheduled.
   (Until Release 2, 18 Nov 2026, there were eight forms. Club updates has a section each for the club's details, members and roles, and a public service; My details has a section each for showing a member's details, removing them, and a business listing. The first question on page 1 leads to the section.)
5. Go back to the Sheet and reload the page. A **Rotary** menu appears.

## 3. Add the seven photo questions by hand (8 minutes)

Google does not let a script add file-upload questions, so these seven are added by hand. Release 2 (18 Nov 2026) moved the
last three into the **My details on the website** form, in its sections: an install that already had them on the old
consent and business forms adds them again there. **The titles must match exactly** (copy them from here).

The forms are in the same folder as the Sheet (testing: **3110Website-Testing**; production: **3110Website**), or open them from the Sheet's **settings** tab (`form_…_url`; change `viewform` to `edit` in the address).

| Form | Add after the question… | Title (copy exactly) | Settings |
|---|---|---|---|
| Club activity or event | **Description** (activity page) | `Photos (up to 3, each under 1 MB)` | File upload · Allow only specific file types: **Image** · Maximum number of files: **3** · Maximum file size: **1 MB** · not required |
| Club activity or event | the **Photos** question you just added (activity page) | `Before photo (optional)` | File upload · **Image** · **1** file · **1 MB** · not required |
| Club activity or event | **Before photo (optional)** | `After photo (optional)` | File upload · **Image** · **1** file · **1 MB** · not required |
| Club activity or event | **Short description (optional)** (event page) | `Photos (up to 3, each under 1 MB)` | File upload · **Image** · **3** files · **1 MB** · not required |
| My details on the website | **Show my photo next to my name** (Photo section) | `My photo (one photo of me alone, under 1 MB)` | File upload · **Image** · **1** file · **1 MB** · not required |
| My details on the website | **Our wedding anniversary** (Celebrations section) | `Couple photo (optional, under 1 MB)` | File upload · **Image** · **1** file · **1 MB** · not required |
| My details on the website | **Business WhatsApp number (optional)** (Your business section) | `Logo or shop photo (optional, under 1 MB)` | File upload · **Image** · **1** file · **1 MB** · not required |

How to add one: open the form → click the question named in the middle column → click **⊕ (Add question)** in the floating toolbar → change the type to **File upload** → Google asks to confirm that respondents will sign in and files go to your Drive → **Continue** → paste the title and set the options above.

For the activity form, also put this in the photo question's description: *Photos must be under 1 MB. Easy way: send the photo to yourself on WhatsApp, save it, then upload that copy.*

And in the **Before photo** question's description: *Only for work that changed a place, such as a school toilet, a classroom or a pond: one photo before the work and one after, taken from the same spot. Show the place, not people. Both are needed; the website shows them side by side.*

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

A new version may also need:
- **`Sidebar.html`** pasted as well, when it changed (the change says so);
- a **file-upload question added by hand** (section 3): Google does not let a script add one;
- a **script property** (Project Settings → Script properties) before pasting, when the change says so.

Each change is described in the commit that made it. The notes for every version installed from October to
17 November 2026 were here until 17 November; they are in this file's history on GitHub.

**What the script does by itself** (India time): the daily jobs at 7 am (48-hour reminders, the July member check);
the bulletin preview on Saturday at 6 pm and the message on Sunday at 8 am; the backup of both Sheets on Sunday at
3 am (8 weeks kept, in the private **Backups** folder; the form copies Google makes with it go to the Bin); the weekly
summary on Monday at 8 am; the clubs-not-posting email on the 1st at 9 am; and every 2 hours, a check that a
**Rebuild site now** was not missed.

## 6. Name the moderators

1. Open the **moderators** tab (main Sheet). Each row is one person in one type: **Content**, **Members**, **Club engagement**, **District office** or **Administrator**. Put the real name and Google email over a placeholder, and keep `active` = **TRUE**. Add rows for more people (one person can have several rows).
   - The **District office** row is where contact form messages are emailed (this replaces the older `contact_email` setting in the **settings** tab) and who gets the Sunday WhatsApp message.
   - **Club engagement** gets the monthly list of quiet clubs (no activity in the last 30 days).
2. Set `sheet_access` to **TRUE** only for people who want to work in the Sheet; leave it **FALSE** (or blank) for those who use only the moderation desk, which needs no Sheet access. The Administrator placeholder starts as TRUE.
3. **Rotary → Administrator → Apply moderators (Sheet access)…** (as the Sheet's owner): it shows who will get access to the Sheet (and, for Members and Administrator rows, the private members Sheet) and asks before doing it.
   - **zone** (Content rows, added 18 Nov 2026): the zones that moderator looks after, such as `Agra` or `Agra, Bareilly`. They are emailed only about those zones' clubs, which come first on their desk. Blank means every zone.
   - Since 18 Nov 2026 an **Administrator** can also add and change moderators on the desk (**Admin → Moderators**); a moderator added there gets the desk only (`sheet_access` FALSE).
4. When someone stops, set their `active` to **FALSE** and run **Apply moderators** again. Setting `sheet_access` to FALSE and running it removes only the Sheet; the person stays on the desk and keeps getting their emails.

After the upgrade, existing rows have a blank `sheet_access`, which counts as FALSE: set TRUE for anyone who should keep the Sheet before running **Apply moderators**, which lists every removal and asks first.

## 7. The moderation desk

The desk (`…/desk/` on the website) lets moderators approve, reject and follow up from their phone without opening the Sheet. It needs the **18 October (desk)** script:

1. Paste the new `Code.gs`, save, then **Deploy → Manage deployments → ✏ → Version: New version → Deploy**. This step matters: the desk talks to the new version. The address stays the same.
2. Reload the Sheet and run **Administrator → Upgrade Sheet**. It adds the **moderator_log** tab.
3. Press **Rotary → Rebuild site now** (or wait for the next update). When the website build next reads the data link, the script remembers its own web address, which the desk's email links need. Until then, emails say "open the Sheet" instead of showing desk buttons.
4. Put a real email on at least one moderators row (your own is fine for a test), then open `…/desk/` from the **Open the moderation desk** button in the next moderator email, and sign in with the emailed code.

**Release 2 (18 Nov 2026):** paste the new `Code.gs`, deploy a new version, run **Upgrade Sheet**. It creates the
**Club updates** and **My details on the website** forms (answers to the private Sheet, tabs `raw_club_updates_form` and
`raw_my_details_form`), points every old form link (settings `form_consent_url` and the others) to the new form at the
right section, and closes the six old forms. (On 18 Nov 2026 Google refused every "has moved" message on the old forms, even plain text; they show Google's own closed note, and Upgrade Sheet lists them until the old forms are deleted.) Then add the three photo questions
to the My details form (section 3), send one test of each section, and run **Administrator → Delete the old forms and
their answer tabs…**: the old forms go to Drive's Bin (30 days) and their `raw_…` tabs are deleted; what they sent stays
in the working tabs. If Google will not unlink an old form, the menu lists it: open that `raw_…` tab, choose **Form → Unlink form**, and run the menu item again. A member's own update (from the email the members list has for them) is applied by itself.

**Release 1 (18 Nov 2026):** paste the new `Code.gs` and `Sidebar.html`, deploy a new version, then run **Administrator → Upgrade Sheet**. It adds the columns `charter_date` and `merged_into` (clubs), `ended_on` (officers, functionaries), `hidden_by` and `hidden_at` (activities), `zone` (moderators), the setting `content_changed_at`, and the private **change_log** tab, where every correction made on the desk is kept. Nothing is deleted. From then on, approvals reach the website at the next of four daily updates (about 9 am, 1 pm, 6 pm, 10 pm).

The desk page on the website holds no data and no addresses. Everything comes from the script after signing in. The script's web address travels only after the `#` in the links emailed to moderators, and the page remembers it on that phone. The web app never serves a page itself, so no web page can run the script's other functions.
