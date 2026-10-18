# Google setup (about 30 minutes, once)

Do this **signed in to Google as rotarian.neerav@gmail.com**, on a computer (not a phone).
You will need two files from this project: `dist/apps-script/Code.gs` and `dist/apps-script/Sidebar.html`.

## 1. Put the script into the Sheet (3 minutes)

1. Open the Sheet **3110Website**.
2. Menu **Extensions → Apps Script**. A new tab opens with a file called `Code.gs`.
3. Select everything in `Code.gs` and delete it. Open `dist/apps-script/Code.gs` from this project, copy **all** of it, and paste it in.
4. Click **+** next to "Files" → **HTML** → name it exactly `Sidebar` (Google adds `.html`). Delete what is in it, then paste the whole of `dist/apps-script/Sidebar.html`.
5. Click the **gear icon (Project Settings)** → set **Time zone** to *(GMT+05:30) India Standard Time*.
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
