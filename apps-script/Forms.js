/**
 * The Google Forms: the activity form, the Club updates form (club details, members and roles, a public service, as
 * sections), the two My details forms (owner, 23 Nov 2026: Show my details, the consent alone; Update my details, the
 * details and the business listing) and the website's contact form. Questions are found again by their titles, so
 * keep titles in Q unchanged. The activity form sends answers to the main Sheet; the others to the private Sheet.
 * Each form's raw answers stay untouched in a "raw_…" tab; the script copies them into the working tabs.
 *
 * The six older forms (club profile, public service, club changes, consent, removal, business) were deleted on
 * 18 Nov 2026; the My details on the website form that replaced three of them was closed on 23 Nov 2026 (its answers
 * still sent are filed as before). Their settings now hold links that open the forms that took their place.
 */

var Q = {
  club: 'Your club',
  name: 'Your name',
  role: 'Your role in the club',
  mobile: 'Your mobile number',
  kind: 'What are you sending?',
  kindActivity: 'An activity we did',
  kindEvent: 'An upcoming event',
  aTitle: 'Activity title',
  aDate: 'Date of activity',
  aTheme: 'Theme',
  aDesc: 'Description',
  aLink: 'Link to your own post (if you posted it already)',
  aHelped: 'People helped (optional)',
  aSpent: 'Amount spent in ₹ (optional)',
  aPartners: 'Other clubs that took part (optional)',
  aConsent: 'Photo consent',
  eTitle: 'Event title',
  eType: 'Event type',
  eStart: 'Start date',
  eTime: 'Start time (optional)',
  eEnd: 'End date (if more than one day)',
  eVenue: 'Venue',
  eCity: 'City or town',
  eOrganiser: 'Organiser',
  eDesc: 'Short description (optional)',
  eMap: 'Map link (optional)',
  eDetails: 'Link for details or registration (optional)',
  pWebsite: 'Club website',
  pFacebook: 'Facebook page',
  pInstagram: 'Instagram',
  pYoutube: 'YouTube',
  pX: 'X (Twitter)',
  pLinkedin: 'LinkedIn',
  pMeeting: 'Meeting day and place',
  pConfirm: 'Confirmation',
  cClub: 'Club',
  cName: "Member's full name (as on club records)",
  cMemberId: 'Rotary member ID (optional)',
  cMobile: "Member's mobile number",
  cFilledBy: 'Who is filling this form?',
  cDirectory: 'List me in the professional directory',
  cProfession: 'Profession',
  cArea: 'Area (city or town)',
  cWhat: 'What I do, in about 20 words',
  cWebsite: 'My website (optional)',
  cSpotlight: 'Member spotlight',
  cContact: 'Show a WhatsApp / call button on my listing',
  cPhoto: 'Show my photo next to my name',
  cBirthday: 'Show my birthday (day and month only)',
  cBirthdayDate: 'My birthday',
  cAnniversary: 'Show our wedding anniversary (day and month only)',
  cSpouseRotarian: 'Is your spouse also a Rotarian?',
  cSpouseName: "Spouse's name",
  cSpouseClub: "Spouse's club (if a Rotarian)",
  cSpouseId: "Spouse's Rotary member ID (if known)",
  cSpouseAgrees: "Spouse's agreement",
  cAnniversaryDate: 'Our wedding anniversary',
  cCoupleAgree: 'Couple photo agreement',
  cDeclaration: 'Declaration',
  rClub: 'Club',
  rName: "Member's full name",
  rMemberId: 'Rotary member ID (optional)',
  rMobile: "Member's mobile number",
  rItems: 'What should be removed?',
  rReason: 'Reason (optional)',
  // added in October 2026 (club services and projects, district campaigns, event registration)
  pProjects: 'Permanent projects (optional)',
  pServices: 'Regular services (optional)',
  aCampaign: 'District campaign (optional)',
  aCampaignCount: 'Campaign count (optional)',
  eRegClose: 'Registration closes on (optional)',
  eFee: 'Fee (optional)',
  // added in Release A (17 October 2026)
  aAvenue: 'Avenue of Service',
  aVideo: 'Video link (optional)',
  aPressPaper: 'Covered in the press: newspaper or news website (optional)',
  aPressDate: 'Covered in the press: date it appeared (optional)',
  aPressLink: 'Covered in the press: link to the news item (optional)',
  eOpen: 'Open to everyone?',
  pMeetingDay: 'Meeting day (optional)',
  sName: 'Name of the service or facility',
  sType: 'Type of service',
  sTimings: 'Days and times it is open',
  sPhone: "The facility's own phone number",
  sAddress: 'Address',
  sCity: 'City or town',
  sMap: 'Google Maps link (optional)',
  sAbout: 'What it offers, in one or two lines (optional)',
  sConfirm: 'Confirmation',
  kName: 'Your name',
  kReply: 'Your email or mobile number, so we can reply',
  kTopic: 'What is it about?',
  kCity: 'Your city or town (optional)',
  kMessage: 'Your message',
  // added 17 November 2026: district work on the activity form; the Rotary Means Business form
  aDistrict: 'District level?',
  bMemberId: 'Your Rotary member ID (optional)',
  bMobile: 'Your mobile number',
  bName: 'Business name',
  bTrade: 'Trade',
  bCity: 'City or town of the business',
  bAbout: 'What your business offers',
  bOffer: 'Offer for Rotarians (optional)',
  bWebsite: 'Business website (optional)',
  bWhatsapp: 'Business WhatsApp number (optional)',
  bTopics: 'Topics I can speak on at club meetings (optional)',
  bConfirm: 'Confirmation',
  // added 17 November 2026: the club changes form (members joining, leaving, moving; club and district roles)
  gMemberId: "Member's Rotary member ID",
  gChange: 'What has changed?',
  gJoined: 'Date joined',
  gLeft: 'Date left',
  gNewClub: 'The new club',
  gMoved: 'Date of the move',
  gDied: 'Date of passing (if known)',
  gClubYear: 'Rotary year of the club role',
  gClubRole: 'Club role',
  gDistYear: 'Rotary year of the district role',
  gTeam: 'District team',
  gCommittee: 'Committee (if any)',
  gRole: 'Role in the team',
  gNote: 'Anything else the moderator should know? (optional)',
  // Release 2 (18 November 2026): the two forms with sections; a new member's own mobile and email
  uKind: 'What do you want to tell the district?',
  mKind: 'What would you like to do?',
  gMobile: "New member's mobile number (optional)",
  gEmail: "New member's email (optional)",
  // the two My details forms (23 November 2026)
  showGrid: 'What may the website show?',
  uCall: 'Number for the Call button',
  uWhatsapp: 'Number for the WhatsApp button',
  uEmail2: 'Second email address',
  uBusiness: 'Rotary Means Business',
};

// The first choice on each of the two forms with sections leads to its section
var CLUB_UPDATE_KINDS = {
  profile: "Our club's details: website, social pages, meeting day and place, projects and services",
  member: 'A member or a role: joined, left, passed away, President, Secretary, Executive Secretary or a district role',
  service: 'A public service the club runs: blood bank, eye care, dialysis, ambulance…',
};
// The member's choice before 23 Nov 2026 ("moved" became the old club's "left" and the new club's "joined")
var CLUB_UPDATE_MEMBER_BEFORE = 'A member or a role: joined, left, moved, passed away, President, Secretary, Executive Secretary or a district role';
var MY_DETAILS_KINDS = {
  consent: 'Show my details on the website: directory, photo, birthday, anniversary',
  removal: 'Remove some or all of my details',
  business: 'List my business, or the topics I can speak on (Rotary Means Business)',
};
// The links named after the forms that were replaced (website, emails) open the form that does it now, at the right
// section where there is one. The six old forms were deleted on 18 Nov 2026; My details was closed on 23 Nov 2026.
var SECTION_LINKS = {
  club_profile: { now: 'club_updates', kind: 'profile' },
  public_service: { now: 'club_updates', kind: 'service' },
  club_change: { now: 'club_updates', kind: 'member' },
  consent: { now: 'show_details' },
  removal: { now: 'show_details' },
  business: { now: 'update_details' },
  update: { now: 'update_details' },
};

/**
 * The two My details forms (owner, 23 Nov 2026). The member's own form is matched only by the Google account it comes
 * from (their email or second email) and goes in at the next website update; one filled by the club's President,
 * Secretary or Executive Secretary is matched only by the Rotary member ID and waits for a Members moderator.
 */
var FILLED_BY = { member: 'The member', club: 'Club President, Secretary or Executive Secretary for the member' };
// Show my details: one row per thing the website can show, each answered List or Do not list
var SHOW_ITEMS = {
  directory: 'Directory listing: my name and club',
  profession: 'Profession, area, what I do and website',
  photo: 'Photo',
  birthday: 'Birthday (day and month only)',
  anniversary: 'Wedding anniversary (day and month only)',
  couple_photo: 'Couple photo on our anniversary',
  call: 'Call button',
  whatsapp: 'WhatsApp button',
  spotlight: 'Member spotlight (the district may feature me)',
};
var SHOW_COLUMNS = ['List', 'Do not list'];
var BUSINESS_CHOICES = {
  none: 'Nothing about a business',
  list: 'List or update my business, or the topics I can speak on',
  remove: 'Remove my business listing',
};
var SHOW_DETAILS_DESCRIPTION = 'Choose what the district website may show about you. Answer List or Do not list for each item; ' +
  'send the form again any time to change your mind. Birthdays and anniversaries are shown as day and month only, never the year. ' +
  'Your email is never shown, and your numbers only as Call and WhatsApp buttons. ' +
  'If you and your spouse are both Rotarians, both listed in the directory and both list the anniversary, the website also shows you ' +
  'together as a Rotarian couple: on the Rotary couples page, on your cards and on the home page on your anniversary.\n\n' +
  'Sent from your own email (the one the district has for you), it goes in at the next website update and you get an email. ' +
  "A club's President, Secretary or Executive Secretary can fill it in for a member: we email the member, and a district moderator checks it first.\n\n" +
  'The details themselves (profession, photo, birthday, numbers) come from the Update my details form.';
var UPDATE_DETAILS_DESCRIPTION = 'Correct or add your details for the district: profession, photo, birthday, anniversary, the numbers for your ' +
  'Call and WhatsApp buttons, a second email address, and your business listing. Fill in only what should change.\n\n' +
  'What the website shows is your choice on the Show my details form.\n\n' +
  'Sent from your own email (the one the district has for you), it goes in at the next website update and you get an email. ' +
  "A club's President, Secretary or Executive Secretary can fill it in for a member: we email both of you, and a district moderator checks it first.";
var MEMBER_PAGE_HELP = "The member's Rotary member ID (from My Rotary or the club's records) is how we find their record. Never published.";
var CLUB_UPDATES_DESCRIPTION = 'Tell the district about your club: its details (website, social pages, meeting, projects and services), ' +
  'a member who joined, left or passed away, a club or district role, or a public service the club runs. ' +
  "A district moderator checks everything before the website or the district's members list changes, and you get an email when it is decided.";

// The club changes form's choices, by the change kept in club_change_requests. "moved" is no longer offered
// (owner, 23 Nov 2026: the old club sends "left", the new club "joined"); moves already sent are still approved.
var CLUB_CHANGE_CHOICES = ['joined', 'left', 'deceased', 'club_role', 'district_role'];
var CLUB_CHANGES = {
  joined: 'A member joined the club', left: 'A member left Rotary or the club', moved: 'A member moved to another club',
  deceased: 'A member passed away', club_role: 'A club role: President, Secretary or Executive Secretary', district_role: 'A district role',
};
var CLUB_OUTSIDE = 'A club outside District 3110';
var REMOVAL_ITEMS = ['Everything', 'Directory listing', 'WhatsApp / call button', 'My photo', 'Birthday', 'Anniversary', 'Couple photo',
  'Business listing (Rotary Means Business)'];
var BUSINESS_DESCRIPTION = 'Rotary Means Business: list your own business on the district website, so Rotarians and the public can find it. ' +
  'For members of Rotary District 3110 only. Fill in your business, or only the speaker question, or both. Send one form per business; ' +
  'send it again any time to update it. A moderator checks every listing before it appears.\n\n' +
  'Shown on the website: your name and club, and the business details below. Your mobile number and email are never shown. ' +
  'No phone numbers in the text, please: the business WhatsApp number, if you give one, is shown only as a WhatsApp button.';

var CONTACT_TOPICS = ['I need help from Rotary', 'I want to volunteer', 'Partnership or CSR', 'Media', 'Something else'];

/** The activity form's description, with the link to the posting guide. */
function activityDescription_() {
  var site = Core_str(settings_().site_url).replace(/\/?$/, '/');
  return 'Share what your club did, or an upcoming event. A moderator checks every entry before it appears on the district website.\n' +
    'Please do not write the names of children.\nTips for a good entry: ' + site + 'how-to-post/';
}

var CLUB_PROFILE_DESCRIPTION = "For club office bearers: your club's website, social media pages, meeting details, permanent projects and " +
  "regular services, shown on your club's page. Send it again any time to update.";

/**
 * Questions added after the forms were first created. setup() and "Upgrade Sheet" add any that are missing to the
 * existing forms, in place (after or before the named question), without recreating the forms.
 */
var LATER_QUESTIONS = [
  { form: 'club_profile', title: Q.pProjects, type: 'paragraph', before: Q.pConfirm,
    help: 'One per line: name – what it is – where. For lasting facilities such as a hospital, clinic, school, library, old-age home, ' +
      'skill centre or dialysis unit. No phone numbers. Type "none" to clear your club\'s list.' },
  { form: 'club_profile', title: Q.pServices, type: 'paragraph', before: Q.pConfirm,
    help: 'One per line: what – when – where. For services that repeat, such as "Free eye check-up – every Thursday, 11 am–1 pm – ' +
      'Roshni Centre". No phone numbers. Type "none" to clear your club\'s list.' },
  { form: 'activity', title: Q.aCampaign, type: 'campaign', after: Q.aHelped,
    help: 'Choose a campaign only if this activity was part of a district drive. The report still needs a photo or a link to your club\'s post.' },
  { form: 'activity', title: Q.aCampaignCount, type: 'number', after: Q.aCampaign,
    help: 'The number in the campaign\'s unit, shown in brackets in the campaign name, e.g. blood units collected. Count only what your own club did.' },
  { form: 'activity', title: Q.eRegClose, type: 'date', after: Q.eEnd, help: 'Leave blank if no registration is needed.' },
  { form: 'activity', title: Q.eFee, type: 'text', after: Q.eRegClose, help: 'For example: Free, or ₹500 per person. Please do not add bank or UPI details.' },
  // Release A
  { form: 'activity', title: Q.aAvenue, type: 'avenue', after: Q.aTheme, required: true,
    help: "Rotary's five Avenues of Service. Club Service: within the club (fellowship, meetings, training). Vocational: through members' " +
      'professions. Community: for the local community. International: with clubs or people abroad. Youth: for young people (Interact, Rotaract, RYLA).' },
  { form: 'activity', title: Q.aVideo, type: 'url', after: Q.aLink,
    help: 'A YouTube, Instagram or Facebook video of this activity, if your club posted one. YouTube videos play on the website.' },
  { form: 'activity', title: Q.aPressPaper, type: 'text', after: Q.aVideo, help: 'For example: Dainik Jagran, Agra edition. Only if a newspaper or news website reported it.' },
  { form: 'activity', title: Q.aPressDate, type: 'date', after: Q.aPressPaper, help: 'The day the news item appeared.' },
  { form: 'activity', title: Q.aPressLink, type: 'url', after: Q.aPressDate,
    help: "A link to the news item on the paper's website or e-paper. Please do not upload photos of the clipping." },
  { form: 'activity', title: Q.eOpen, type: 'yesno', after: Q.eType, help: 'Yes if anyone, not only Rotarians, may come. The website marks it "Open to everyone".' },
  { form: 'club_profile', title: Q.pMeetingDay, type: 'weekday', after: Q.pMeeting + ' (optional)',
    help: 'The weekday your club usually meets, so visitors can find a club meeting on a day that suits them.' },
  // 17 November 2026
  { form: 'activity', title: Q.aDistrict, type: 'yesno', after: Q.aAvenue,
    help: 'Yes only if the district organised it or it was a district occasion, for example a grant inauguration or a district seminar. ' +
      'The Governor need not have been there. The website marks it "District". A moderator checks this.' },
];

function laterQuestion_(title) {
  return LATER_QUESTIONS.filter(function (q) { return q.title === title; })[0];
}

function addLaterQuestion_(form, title, L) {
  var q = laterQuestion_(title);
  var item;
  if (q.type === 'paragraph') item = form.addParagraphTextItem().setTitle(q.title).setHelpText(q.help);
  else if (q.type === 'campaign') item = form.addListItem().setTitle(q.title).setHelpText(q.help).setChoiceValues(L.campaigns);
  else if (q.type === 'avenue') item = form.addListItem().setTitle(q.title).setHelpText(q.help).setChoiceValues(CORE_AVENUES);
  else if (q.type === 'weekday') item = form.addListItem().setTitle(q.title).setHelpText(q.help).setChoiceValues(CORE_WEEKDAYS);
  else if (q.type === 'yesno') item = form.addMultipleChoiceItem().setTitle(q.title).setHelpText(q.help).setChoiceValues(YES_NO);
  else if (q.type === 'number') item = form.addTextItem().setTitle(q.title).setHelpText(q.help).setValidation(numberRule_());
  else if (q.type === 'date') item = form.addDateItem().setTitle(q.title).setHelpText(q.help);
  else if (q.type === 'url') item = form.addTextItem().setTitle(q.title).setHelpText(q.help).setValidation(urlRule_());
  else {
    item = form.addTextItem().setTitle(q.title).setHelpText(q.help)
      .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(60).setHelpText('Up to 60 characters').build());
  }
  if (q.required) item.setRequired(true);
  return item;
}

/** Adds any missing later question to the existing forms, in its place. Safe to run more than once. */
function addLaterQuestions_(report) {
  var ids = JSON.parse(props_().getProperty('FORM_IDS') || '{}');
  var L = formLists_();
  LATER_QUESTIONS.forEach(function (q) {
    if (!ids[q.form]) return;
    var form = FormApp.openById(ids[q.form]);
    var titles = function () { return form.getItems().map(function (it) { return it.getTitle(); }); };
    if (titles().indexOf(q.title) >= 0) return;
    var item = addLaterQuestion_(form, q.title, L);
    var anchor = titles().indexOf(q.after || q.before);
    if (anchor >= 0) form.moveItem(item.getIndex(), q.after ? anchor + 1 : anchor);
    report.push('Added the question "' + q.title + '" to the ' + q.form.replace('_', ' ') + ' form' + (anchor < 0 ? ' (at the end: please move it)' : ''));
  });
  if (ids.club_profile) FormApp.openById(ids.club_profile).setDescription(CLUB_PROFILE_DESCRIPTION);
  if (ids.club_updates) dropMovedSection_(FormApp.openById(ids.club_updates), report);
  ['removal'].forEach(function (key) {
    if (!ids[key]) return;
    // the removal form offers each thing that can be shown, the business listing included (17 Nov 2026)
    FormApp.openById(ids[key]).getItems().forEach(function (it) {
      if (it.getTitle() !== Q.rItems) return;
      var box = it.asCheckboxItem();
      var now = box.getChoices().map(function (c) { return c.getValue(); });
      if (now.join('|') !== REMOVAL_ITEMS.join('|')) {
        box.setChoiceValues(REMOVAL_ITEMS);
        report.push('Updated the choices on the removal form (business listing added)');
      }
    });
  });
  if (ids.consent) {
    var consentForm = FormApp.openById(ids.consent);
    if (consentForm.getDescription() !== CONSENT_DESCRIPTION) {
      consentForm.setDescription(CONSENT_DESCRIPTION);
      report.push('Updated the consent form wording (the member is emailed when someone else fills it in)');
    }
  }
  if (ids.activity) {
    var activity = FormApp.openById(ids.activity);
    activity.setDescription(activityDescription_());
    activity.getItems().forEach(function (it) {
      if (it.getTitle() !== Q.aConsent) return;
      var box = it.asCheckboxItem();
      var now = box.getChoices().map(function (c) { return c.getValue(); });
      if (now.length !== 1 || now[0] !== PHOTO_CONSENT_TEXT) {
        box.setChoiceValues([PHOTO_CONSENT_TEXT]);
        report.push('Updated the photo consent wording on the activity form');
      }
    });
  }
}

var YES_NO = ['Yes', 'No'];
// Senders are told the member hears about the form (consent safeguards, 1 Nov 2026)
var CONSENT_DESCRIPTION = 'Choose what the district website may show about you. Each item is a separate choice, and you can change your mind at any time ' +
  'using the removal form. Birthdays and anniversaries are shown as day and month only, never the year.\n\n' +
  'If you fill this in for another member (for example as club secretary), we email the member at the address the district has for them, ' +
  'with your email address and what you asked to show, and wait a few days before anything is shown.';
// Photos arrive with consent (decided 18 Oct): moderators reject photos sent without this tick
var PHOTO_CONSENT_TEXT = 'Everyone identifiable in these photos agreed to them being published, and for children, a parent or guardian agreed.';
var MOBILE_PATTERN = '^(\\+?91[ -]?)?0?[6-9][0-9]{4}[ -]?[0-9]{5}$';

function textRule_(pattern, help) {
  return FormApp.createTextValidation().requireTextMatchesPattern(pattern).setHelpText(help).build();
}
function urlRule_() {
  return FormApp.createTextValidation().requireTextIsUrl().setHelpText('Please paste a full web address starting with https://').build();
}
function numberRule_() {
  return FormApp.createTextValidation().requireWholeNumber().setHelpText('Numbers only, no commas').build();
}

function formLists_() {
  var s = settings_();
  var activeClubs = clubs_().filter(function (c) { return Core_str(c.status || 'active') === 'active'; })
    .map(function (c) { return Core_str(c.club_name); }).sort();
  var lists = readTab_(mainSs_(), 'lists');
  var pick = function (list) { return lists.filter(function (r) { return r.list === list; }).map(function (r) { return Core_str(r.value); }); };
  var areas = pick('area');
  if (!areas.length) areas = clubs_().map(function (c) { return Core_str(c.city); }).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).sort();
  var professions = pick('profession');
  if (!professions.length) professions = Core_list(s.professions);
  var teams = readTab_(mainSs_(), 'functionaries').map(function (f) { return Core_str(f.section); })
    .filter(function (x, i, a) { return x && a.indexOf(x) === i; });
  // role years follow today's date, not the year the website shows, so a club can report this year's and next year's
  // office bearers (Release 1, 18 Nov 2026)
  var year = Core_rotaryYearOf(today_());
  return {
    clubs: activeClubs.length ? activeClubs : ['(clubs not loaded yet)'],
    areas: areas.length ? areas : ['(areas not loaded yet)'],
    professions: professions.length ? professions.concat(['Other']) : ['Other'],
    organisers: activeClubs.concat(teams.length ? teams : ["Governor's Office Team"]),
    roles: ['President', 'Secretary', 'Public Image Chair', 'Other office bearer', 'Member'],
    serviceTypes: CORE_SERVICE_TYPES.slice(),
    trades: CORE_TRADES.slice(),
    campaigns: [CORE_NO_CAMPAIGN].concat(Core_openCampaigns(readTab_(mainSs_(), 'campaigns'), today_()).map(Core_campaignLabel)),
    newClubs: (activeClubs.length ? activeClubs : ['(clubs not loaded yet)']).concat([CLUB_OUTSIDE]),
    teams: teams.length ? teams.slice().sort() : ["Governor's Office Team"],
    years: [year, Core_nextRotaryYear(year)],
    // a district role may be told up to three years ahead, for the Governor Nominee and Nominee Designate (owner, 24 Nov 2026)
    districtYears: [year, Core_nextRotaryYear(year), Core_nextRotaryYear(Core_nextRotaryYear(year)),
      Core_nextRotaryYear(Core_nextRotaryYear(Core_nextRotaryYear(year)))],
  };
}

function createForms_(report) {
  var ids = JSON.parse(props_().getProperty('FORM_IDS') || '{}');
  var L = formLists_();
  var makers = { activity: makeActivityForm_, contact: makeContactForm_, club_updates: makeClubUpdatesForm_,
    show_details: makeShowDetailsForm_, update_details: makeUpdateDetailsForm_ };
  var destinations = { activity: mainSs_().getId(), contact: privateSheetId_(), club_updates: privateSheetId_(),
    show_details: privateSheetId_(), update_details: privateSheetId_() };
  var rawNames = { activity: 'raw_activity_form', contact: 'raw_contact_form', club_updates: 'raw_club_updates_form',
    show_details: 'raw_show_details_form', update_details: 'raw_update_details_form' };

  Object.keys(makers).forEach(function (key) {
    var form = null;
    if (ids[key]) {
      try { form = FormApp.openById(ids[key]); } catch (e) { form = null; }
    }
    if (!form) {
      form = makers[key](L);
      form.setDestination(FormApp.DestinationType.SPREADSHEET, destinations[key]);
      ids[key] = form.getId();
      props_().setProperty('FORM_IDS', JSON.stringify(ids));
      SpreadsheetApp.flush();
      renameResponseSheet_(destinations[key], form, rawNames[key]);
      report.push('Created the ' + key.replace('_', ' ') + ' form');
    }
    keepInSheetFolder_(form.getId(), 'the ' + key.replace('_', ' ') + ' form', report);
    setSetting_('form_' + key + '_url', form.getPublishedUrl());
  });
  // the older forms' links (on the website and in emails) now open the new form at the right section
  Object.keys(SECTION_LINKS).forEach(function (key) {
    var o = SECTION_LINKS[key];
    var url = sectionLink_(o.now, o.kind);
    if (url) setSetting_('form_' + key + '_url', url);
  });
  // the two My details forms replace My details on the website (23 Nov 2026): it stops taking answers
  if (ids.my_details) {
    try {
      var old = FormApp.openById(ids.my_details);
      if (old.isAcceptingResponses()) {
        old.setAcceptingResponses(false);
        report.push('Closed the old My details on the website form (Show my details and Update my details replace it)');
      }
    } catch (e) {
      report.push('Could not close the old My details on the website form (' + e.message + '): close it by hand (Responses → Accepting responses off)');
    }
  }
}

/** A link to the Club updates or My details form with the first question already answered, so it opens at that section. */
function sectionLink_(formKey, kind) {
  var ids = JSON.parse(props_().getProperty('FORM_IDS') || '{}');
  if (!ids[formKey]) return '';
  var form = FormApp.openById(ids[formKey]);
  if (!kind) return form.getPublishedUrl();
  var title = formKey === 'club_updates' ? Q.uKind : Q.mKind;
  var text = (formKey === 'club_updates' ? CLUB_UPDATE_KINDS : MY_DETAILS_KINDS)[kind];
  var item = form.getItems().filter(function (it) { return it.getTitle() === title; })[0];
  if (!item) return form.getPublishedUrl();
  try {
    return form.createResponse().withItemResponse(item.asMultipleChoiceItem().createResponse(text)).toPrefilledUrl();
  } catch (e) {
    return form.getPublishedUrl();
  }
}

/** Google creates new forms in My Drive; move one into the folder that holds the main Sheet (testing or production). */
function keepInSheetFolder_(fileId, label, report) {
  try {
    var parents = DriveApp.getFileById(mainSs_().getId()).getParents();
    if (!parents.hasNext()) return;
    var folder = parents.next();
    var file = DriveApp.getFileById(fileId);
    var own = file.getParents();
    while (own.hasNext()) if (own.next().getId() === folder.getId()) return;
    file.moveTo(folder);
    report.push('Moved ' + label + ' into the folder "' + folder.getName() + '"');
  } catch (e) {
    report.push('Could not move ' + label + ' next to the Sheet (' + e.message + '); move it by hand');
  }
}

function renameResponseSheet_(ssId, form, name) {
  var ss = SpreadsheetApp.openById(ssId);
  var formId = form.getId();
  ss.getSheets().forEach(function (sh) {
    var url = sh.getFormUrl();
    if (url && url.indexOf(formId) >= 0 && !ss.getSheetByName(name)) {
      sh.setName(name);
      sh.protect().setDescription('Original form answers – kept unchanged').setWarningOnly(true);
    }
  });
}

function baseForm_(title, description) {
  var form = FormApp.create(title);
  form.setDescription(description);
  form.setCollectEmail(true);
  form.setAllowResponseEdits(false);
  form.setProgressBar(true);
  form.setConfirmationMessage('Thank you! A district moderator will check this within 48 hours. You will get an email when it is decided.');
  return form;
}

/**
 * The club only (B11, decision 141, 23 Nov 2026): the sender is known by the Verified email the form collects; their
 * name, role and mobile come from the members list and the club's office bearers.
 */
function addSender_(form, L) {
  form.addListItem().setTitle(Q.club).setChoiceValues(L.clubs).setRequired(true);
}

/**
 * Upgrade Sheet (B11): takes "Your name", "Your role in the club" and "Your mobile number" off the live activity and
 * Club updates forms. Answers already sent stay in the Sheet. Google refuses some form changes, so a refusal is
 * reported and the rest of the upgrade goes on.
 */
function dropSenderQuestions_(report) {
  var ids = JSON.parse(props_().getProperty('FORM_IDS') || '{}');
  [['activity', 'activity'], ['club_updates', 'Club updates']].forEach(function (pair) {
    if (!ids[pair[0]]) return;
    try {
      var form = FormApp.openById(ids[pair[0]]);
      var gone = form.getItems().filter(function (it) { return [Q.name, Q.role, Q.mobile].indexOf(it.getTitle()) >= 0; });
      if (!gone.length) return;
      gone.forEach(function (it) { form.deleteItem(it); });
      report.push('The ' + pair[1] + ' form no longer asks the sender\'s name, role and mobile (taken from the members list by their email)');
    } catch (e) {
      report.push('The ' + pair[1] + ' form: could not remove "Your name", "Your role in the club" and "Your mobile number" (' + e.message +
        '); delete them by hand in the form');
    }
  });
}

function makeActivityForm_(L) {
  var form = baseForm_('Club activity or event – Rotary District 3110', activityDescription_());
  addSender_(form, L);
  var kind = form.addMultipleChoiceItem().setTitle(Q.kind).setRequired(true);

  var activityPage = form.addPageBreakItem().setTitle('About the activity');
  form.addTextItem().setTitle(Q.aTitle).setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(80).setHelpText('Up to 80 characters').build());
  form.addDateItem().setTitle(Q.aDate).setRequired(true);
  form.addListItem().setTitle(Q.aTheme).setChoiceValues(CORE_THEMES).setRequired(true)
    .setHelpText("Rotary's seven Areas of Focus, or Club service / Other for installations, fellowship, training and similar.");
  addLaterQuestion_(form, Q.aAvenue, L);
  addLaterQuestion_(form, Q.aDistrict, L);
  form.addParagraphTextItem().setTitle(Q.aDesc).setRequired(true)
    .setHelpText('Two to five lines. Please do not write the names of children.')
    .setValidation(FormApp.createParagraphTextValidation().requireTextMatchesPattern('^[\\s\\S]{100,600}$')
      .setHelpText('Please write between 100 and 600 characters (about 2–5 lines)').build());
  // The photo question is added here by hand (Google does not allow scripts to add file uploads), and after it the
  // optional "Before photo" and "After photo" questions (17 Nov 2026; see the Google setup guide)
  form.addTextItem().setTitle(Q.aLink).setHelpText('If your club already posted this on its website or social page, paste the link instead of photos.')
    .setValidation(urlRule_());
  addLaterQuestion_(form, Q.aVideo, L);
  addLaterQuestion_(form, Q.aPressPaper, L);
  addLaterQuestion_(form, Q.aPressDate, L);
  addLaterQuestion_(form, Q.aPressLink, L);
  form.addTextItem().setTitle(Q.aHelped).setValidation(numberRule_());
  addLaterQuestion_(form, Q.aCampaign, L);
  addLaterQuestion_(form, Q.aCampaignCount, L);
  form.addTextItem().setTitle(Q.aSpent).setValidation(numberRule_());
  form.addCheckboxItem().setTitle(Q.aPartners).setChoiceValues(L.clubs);
  form.addCheckboxItem().setTitle(Q.aConsent).setRequired(true).setChoiceValues([PHOTO_CONSENT_TEXT]);

  var eventPage = form.addPageBreakItem().setTitle('About the event');
  form.addTextItem().setTitle(Q.eTitle).setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(80).setHelpText('Up to 80 characters').build());
  form.addListItem().setTitle(Q.eType).setChoiceValues(CORE_EVENT_TYPES).setRequired(true);
  addLaterQuestion_(form, Q.eOpen, L);
  form.addDateItem().setTitle(Q.eStart).setRequired(true);
  form.addTimeItem().setTitle(Q.eTime);
  form.addDateItem().setTitle(Q.eEnd);
  addLaterQuestion_(form, Q.eRegClose, L);
  addLaterQuestion_(form, Q.eFee, L);
  form.addTextItem().setTitle(Q.eVenue).setRequired(true);
  form.addListItem().setTitle(Q.eCity).setChoiceValues(L.areas).setRequired(true);
  form.addListItem().setTitle(Q.eOrganiser).setChoiceValues(L.organisers).setRequired(true);
  form.addParagraphTextItem().setTitle(Q.eDesc)
    .setValidation(FormApp.createParagraphTextValidation().requireTextLengthLessThanOrEqualTo(400).setHelpText('Up to 400 characters').build());
  form.addTextItem().setTitle(Q.eMap).setValidation(urlRule_());
  form.addTextItem().setTitle(Q.eDetails).setHelpText('No payment or ticket-price links, please.').setValidation(urlRule_());

  kind.setChoices([kind.createChoice(Q.kindActivity, activityPage), kind.createChoice(Q.kindEvent, eventPage)]);
  eventPage.setGoToPage(FormApp.PageNavigationType.SUBMIT); // after the activity page, submit (skip the event page)
  return form;
}

/**
 * Club updates (Release 2): the club profile, club changes and public service forms in one, with a section each.
 * Page 1 asks who is sending and what about; the answer leads to the section, and each section ends the form.
 * The question titles are the old forms' own, so the same filing code reads them.
 */
function makeClubUpdatesForm_(L) {
  var form = baseForm_('Club updates – Rotary District 3110', CLUB_UPDATES_DESCRIPTION);
  addSender_(form, L);
  var kind = form.addMultipleChoiceItem().setTitle(Q.uKind).setRequired(true);

  var profile = form.addPageBreakItem().setTitle("Our club's details").setHelpText(CLUB_PROFILE_DESCRIPTION);
  [Q.pWebsite, Q.pFacebook, Q.pInstagram, Q.pYoutube, Q.pX, Q.pLinkedin].forEach(function (t) {
    form.addTextItem().setTitle(t + ' (optional)').setValidation(urlRule_());
  });
  form.addTextItem().setTitle(Q.pMeeting + ' (optional)').setHelpText('For example: Every Tuesday, 7:30 pm, Hotel Grand, Agra');
  addLaterQuestion_(form, Q.pMeetingDay, L);
  addLaterQuestion_(form, Q.pProjects, L);
  addLaterQuestion_(form, Q.pServices, L);
  form.addCheckboxItem().setTitle(Q.pConfirm).setRequired(true)
    .setChoiceValues(['I am an office bearer of this club and these links belong to the club.']);

  var member = form.addPageBreakItem().setTitle('A member or a role')
    .setHelpText("Give the member's Rotary member ID (from My Rotary or the club's records). A Members moderator checks every change.");
  form.addTextItem().setTitle(Q.gMemberId).setRequired(true)
    .setValidation(FormApp.createTextValidation().requireWholeNumber().setHelpText('Numbers only').build())
    .setHelpText("From My Rotary or the club's records. Never published.");
  form.addTextItem().setTitle(Q.rName).setRequired(true);
  var change = form.addMultipleChoiceItem().setTitle(Q.gChange).setRequired(true);
  var pages = clubChangePages_(form, L);

  var service = form.addPageBreakItem().setTitle('A public service the club runs')
    .setHelpText('A lasting facility the public can use, such as a blood bank, eye hospital, dialysis unit, clinic, library, skill centre or ambulance. ' +
      'Send one per facility.');
  addServiceQuestions_(form, L);

  kind.setChoices([kind.createChoice(CLUB_UPDATE_KINDS.profile, profile), kind.createChoice(CLUB_UPDATE_KINDS.member, member),
    kind.createChoice(CLUB_UPDATE_KINDS.service, service)]);
  member.setGoToPage(FormApp.PageNavigationType.SUBMIT); // the club details section ends the form
  change.setChoices(CLUB_CHANGE_CHOICES.map(function (k) { return change.createChoice(CLUB_CHANGES[k], pages[k]); }));
  service.setGoToPage(FormApp.PageNavigationType.SUBMIT); // the member section ends with its note
  form.setConfirmationMessage('Thank you! A district moderator will check this within 48 hours. You will get an email when it is decided.');
  return form;
}

/** The club changes form's pages, one per kind of change, each going on to the note (shared by both forms). */
function clubChangePages_(form, L) {
  var p = {};
  p.joined = form.addPageBreakItem().setTitle(CLUB_CHANGES.joined);
  form.addDateItem().setTitle(Q.gJoined).setRequired(true);
  form.addTextItem().setTitle(Q.gMobile).setHelpText('Only the district sees this, to send the member the website\'s yearly check. Never published.')
    .setValidation(textRule_(MOBILE_PATTERN, 'Please give a 10-digit mobile number'));
  form.addTextItem().setTitle(Q.gEmail).setHelpText('Only the district sees this. Never published.')
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().setHelpText('Please give an email address').build());
  p.left = form.addPageBreakItem().setTitle(CLUB_CHANGES.left);
  form.addDateItem().setTitle(Q.gLeft).setRequired(true);
  p.deceased = form.addPageBreakItem().setTitle(CLUB_CHANGES.deceased);
  form.addDateItem().setTitle(Q.gDied);
  p.club_role = form.addPageBreakItem().setTitle(CLUB_CHANGES.club_role);
  form.addListItem().setTitle(Q.gClubYear).setChoiceValues(L.years).setRequired(true);
  form.addListItem().setTitle(Q.gClubRole).setChoiceValues(CORE_CLUB_ROLES.slice()).setRequired(true);
  p.district_role = form.addPageBreakItem().setTitle(CLUB_CHANGES.district_role)
    .setHelpText('The member may be from another club. Please say in the note who decided it, for example the Governor\'s letter.');
  form.addListItem().setTitle(Q.gDistYear).setChoiceValues(L.districtYears).setRequired(true);
  form.addListItem().setTitle(Q.gTeam).setChoiceValues(L.teams).setRequired(true);
  form.addTextItem().setTitle(Q.gCommittee).setHelpText('As the district names it, for example District Social Media Management Committee');
  form.addTextItem().setTitle(Q.gRole).setRequired(true).setHelpText('For example: Chairman, Co-chairman, Member, Assistant Governor')
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(60).setHelpText('Up to 60 characters').build());
  var note = form.addPageBreakItem().setTitle('Anything else');
  form.addParagraphTextItem().setTitle(Q.gNote)
    .setValidation(FormApp.createParagraphTextValidation().requireTextLengthLessThanOrEqualTo(500).setHelpText('Up to 500 characters').build());
  // each kind's page goes on to the note (a page break's "go to" applies at the end of the page before it)
  [p.left, p.deceased, p.club_role, p.district_role].forEach(function (x) { x.setGoToPage(note); });
  p.note = note;
  return p;
}

function addServiceQuestions_(form, L) {
  form.addTextItem().setTitle(Q.sName).setRequired(true).setHelpText('For example: Rotary Blood Bank, Civil Lines')
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(80).setHelpText('Up to 80 characters').build());
  form.addListItem().setTitle(Q.sType).setChoiceValues(L.serviceTypes).setRequired(true);
  form.addTextItem().setTitle(Q.sTimings).setRequired(true).setHelpText('For example: Every day, 9 am–8 pm; or Open 24 hours')
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(80).setHelpText('Up to 80 characters').build());
  form.addTextItem().setTitle(Q.sPhone).setRequired(true)
    .setHelpText("The facility's public number (reception or helpline), never a member's personal mobile. It will be shown on the website.")
    .setValidation(textRule_('^[0-9 +()-]{3,24}$', 'Digits only, with spaces or dashes if you like, e.g. 0562 222 3344'));
  form.addTextItem().setTitle(Q.sAddress).setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(150).setHelpText('Up to 150 characters').build());
  form.addListItem().setTitle(Q.sCity).setChoiceValues(L.areas).setRequired(true);
  form.addTextItem().setTitle(Q.sMap).setHelpText('Open the place in Google Maps, tap Share and paste the link here.').setValidation(urlRule_());
  form.addTextItem().setTitle(Q.sAbout).setHelpText('For example: Free dialysis for patients below the poverty line; nominal charge for others.')
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(200).setHelpText('Up to 200 characters').build());
  form.addCheckboxItem().setTitle(Q.sConfirm).setRequired(true)
    .setChoiceValues(["I am an office bearer of this club, the club runs or supports this facility, and the phone number is the facility's own public number."]);
}

/**
 * Show my details on the website (owner, 23 Nov 2026): only what the website may show, List or Do not list for each.
 * Page 1 asks who is filling it; the club's office bearers first give the member's Rotary member ID and name.
 */
function makeShowDetailsForm_(L) {
  var form = baseForm_('Show my details on the website – Rotary District 3110', SHOW_DETAILS_DESCRIPTION);
  var who = form.addMultipleChoiceItem().setTitle(Q.cFilledBy).setRequired(true);
  var member = addMemberPage_(form);
  var choices = form.addPageBreakItem().setTitle('What the website may show');
  form.addGridItem().setTitle(Q.showGrid).setRequired(true).setRows(Object.keys(SHOW_ITEMS).map(function (k) { return SHOW_ITEMS[k]; }))
    .setColumns(SHOW_COLUMNS)
    .setHelpText('List or Do not list for every item. A listed item shows once the district has it: your photo, birthday or numbers ' +
      'come from the Update my details form. The anniversary and couple photo show only when your spouse agrees too; ' +
      'for two Rotarians, the anniversary also shows you as a Rotarian couple.');
  form.addCheckboxItem().setTitle(Q.cDeclaration).setRequired(true)
    .setChoiceValues(['These are my choices. (Filled in by the club: the member agreed to each of them.)']);
  who.setChoices([who.createChoice(FILLED_BY.member, choices), who.createChoice(FILLED_BY.club, member)]);
  form.setConfirmationMessage('Thank you! Sent from your own email, it goes in at the next website update and you get an email. ' +
    'Filled in by the club: the member is told, and a district moderator checks it first.');
  return form;
}

/** The page where a club office bearer says which member the form is for: the Rotary member ID finds them. */
function addMemberPage_(form) {
  var page = form.addPageBreakItem().setTitle('The member').setHelpText(MEMBER_PAGE_HELP);
  form.addTextItem().setTitle(Q.gMemberId).setRequired(true)
    .setValidation(FormApp.createTextValidation().requireWholeNumber().setHelpText('Numbers only').build());
  form.addTextItem().setTitle(Q.rName).setRequired(true).setHelpText('So the moderator can see it is the right person.');
  return page;
}

/**
 * Update my details (owner, 23 Nov 2026): the details themselves, all optional (blank: no change), and the business
 * listing. The "My photo", "Couple photo" and "Logo or shop photo (optional)" upload questions are added by hand
 * (Google does not let scripts add uploads), in the details page and the business page.
 */
function makeUpdateDetailsForm_(L) {
  var form = baseForm_('Update my details – Rotary District 3110', UPDATE_DETAILS_DESCRIPTION);
  var who = form.addMultipleChoiceItem().setTitle(Q.cFilledBy).setRequired(true);
  var member = addMemberPage_(form);
  var details = form.addPageBreakItem().setTitle('The details').setHelpText('Fill in only what should change; leave the rest blank.');
  form.addListItem().setTitle(Q.cProfession).setChoiceValues(L.professions);
  form.addListItem().setTitle(Q.cArea).setChoiceValues(L.areas);
  form.addTextItem().setTitle(Q.cWhat).setHelpText('About 20 words. No phone numbers or email addresses.')
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(150).setHelpText('Up to 150 characters').build());
  form.addTextItem().setTitle(Q.cWebsite).setValidation(urlRule_());
  form.addTextItem().setTitle(Q.uCall).setHelpText('Shown only as a Call button, and only if you chose to list it. Leave blank to use the mobile Rotary has for you.')
    .setValidation(textRule_(MOBILE_PATTERN, 'Please give a 10-digit mobile number'));
  form.addTextItem().setTitle(Q.uWhatsapp).setHelpText('Shown only as a WhatsApp button, and only if you chose to list it. Leave blank to use the Call number.')
    .setValidation(textRule_(MOBILE_PATTERN, 'Please give a 10-digit mobile number'));
  form.addTextItem().setTitle(Q.uEmail2)
    .setHelpText('If the email Rotary has for you is old or you cannot open it, give the one you use. You can then send these forms from it. Never shown.')
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().setHelpText('Please give an email address').build());
  form.addDateItem().setTitle(Q.cBirthdayDate).setIncludesYear(false).setHelpText('Day and month only.');
  // "My photo" upload question is added here by hand
  form.addDateItem().setTitle(Q.cAnniversaryDate).setIncludesYear(false).setHelpText('Day and month only.');
  form.addMultipleChoiceItem().setTitle(Q.cSpouseRotarian).setChoiceValues(YES_NO);
  form.addTextItem().setTitle(Q.cSpouseName).setHelpText('If your spouse is not a Rotarian, only the first name is shown.');
  form.addListItem().setTitle(Q.cSpouseClub).setChoiceValues(L.clubs);
  form.addTextItem().setTitle(Q.cSpouseId).setHelpText('Needed if your spouse is a Rotarian: it is how we find them. They choose for themselves on the Show my details form.')
    .setValidation(FormApp.createTextValidation().requireWholeNumber().setHelpText('Numbers only').build());
  form.addCheckboxItem().setTitle(Q.cSpouseAgrees).setChoiceValues(['My spouse (not a Rotarian) agrees to our anniversary being shown.']);
  // "Couple photo" upload question is added here by hand
  form.addCheckboxItem().setTitle(Q.cCoupleAgree)
    .setChoiceValues(['My spouse agrees to the couple photo being shown on our anniversary card.']);
  form.addCheckboxItem().setTitle(Q.cDeclaration).setRequired(true)
    .setChoiceValues(['These details are correct. (Filled in by the club: the member asked for these changes.)']);
  var business = form.addMultipleChoiceItem().setTitle(Q.uBusiness).setRequired(true);

  var page = form.addPageBreakItem().setTitle('Your business').setHelpText(BUSINESS_DESCRIPTION + '\n\nLeave this page blank if you only want to be listed as a speaker.');
  form.addTextItem().setTitle(Q.bName).setHelpText('For example: Gupta Opticals')
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(80).setHelpText('Up to 80 characters').build());
  form.addListItem().setTitle(Q.bTrade).setChoiceValues(L.trades);
  form.addListItem().setTitle(Q.bCity).setChoiceValues(L.areas);
  form.addParagraphTextItem().setTitle(Q.bAbout).setHelpText('One or two lines. No phone numbers or email addresses.')
    .setValidation(FormApp.createParagraphTextValidation().requireTextLengthLessThanOrEqualTo(300).setHelpText('Up to 300 characters').build());
  form.addTextItem().setTitle(Q.bOffer).setHelpText('For example: 10% off for Rotarians and their families')
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(100).setHelpText('Up to 100 characters').build());
  form.addTextItem().setTitle(Q.bWebsite).setValidation(urlRule_());
  form.addTextItem().setTitle(Q.bWhatsapp).setHelpText('Shown only as a WhatsApp button on your listing, never as a number.')
    .setValidation(textRule_(MOBILE_PATTERN, 'Please give a 10-digit mobile number'));
  // "Logo or shop photo (optional)" upload question is added here by hand
  form.addParagraphTextItem().setTitle(Q.bTopics)
    .setHelpText('Clubs look for speakers for their meetings. For example: Income tax for families; First aid at home. Leave blank if not.')
    .setValidation(FormApp.createParagraphTextValidation().requireTextLengthLessThanOrEqualTo(300).setHelpText('Up to 300 characters').build());
  form.addCheckboxItem().setTitle(Q.bConfirm).setRequired(true)
    .setChoiceValues(['I am a member of this club, this is my own business (or one I am a partner in), and I agree to my name, club and these details being shown on the district website.']);

  who.setChoices([who.createChoice(FILLED_BY.member, details), who.createChoice(FILLED_BY.club, member)]);
  business.setChoices([business.createChoice(BUSINESS_CHOICES.none, FormApp.PageNavigationType.SUBMIT),
    business.createChoice(BUSINESS_CHOICES.list, page), business.createChoice(BUSINESS_CHOICES.remove, FormApp.PageNavigationType.SUBMIT)]);
  form.setConfirmationMessage('Thank you! Sent from your own email, it goes in at the next website update and you get an email. ' +
    'Filled in by the club: the member is told, and a district moderator checks it first.');
  return form;
}

/**
 * Upgrade Sheet (23 Nov 2026): the Club updates form no longer offers "A member moved to another club" (the old club
 * sends "left", the new club "joined"), and its first choice no longer says "moved". Google refuses some form changes,
 * so a refusal is reported and the rest of the upgrade goes on.
 */
function dropMovedSection_(form, report) {
  try {
    var items = form.getItems();
    var pages = {};
    items.forEach(function (it) { if (it.getType() === FormApp.ItemType.PAGE_BREAK) pages[it.getTitle()] = it.asPageBreakItem(); });
    var change = items.filter(function (it) { return it.getTitle() === Q.gChange; })[0];
    var kind = items.filter(function (it) { return it.getTitle() === Q.uKind; })[0];
    if (kind) {
      var k = kind.asMultipleChoiceItem();
      if (k.getChoices().some(function (c) { return c.getValue() === CLUB_UPDATE_MEMBER_BEFORE; })) {
        k.setChoices([k.createChoice(CLUB_UPDATE_KINDS.profile, pages["Our club's details"]), k.createChoice(CLUB_UPDATE_KINDS.member, pages['A member or a role']),
          k.createChoice(CLUB_UPDATE_KINDS.service, pages['A public service the club runs'])]);
        report.push('Club updates: the members and roles choice no longer says "moved"');
      }
    }
    if (form.getDescription() !== CLUB_UPDATES_DESCRIPTION) form.setDescription(CLUB_UPDATES_DESCRIPTION);
    if (!change) return;
    var c = change.asMultipleChoiceItem();
    var offered = c.getChoices().some(function (x) { return x.getValue() === CLUB_CHANGES.moved; });
    var left = items.filter(function (it) { return [Q.gMoved, Q.gNewClub, CLUB_CHANGES.moved].indexOf(it.getTitle()) >= 0; });
    if (!offered && !left.length) return;
    // first nothing leads to the page any more, then the page and its questions go (a refusal here is tried again next time)
    if (offered) c.setChoices(CLUB_CHANGE_CHOICES.map(function (key) { return c.createChoice(CLUB_CHANGES[key], pages[CLUB_CHANGES[key]]); }));
    left.forEach(function (it) { form.deleteItem(it); });
    report.push('Club updates: "A member moved to another club" removed (the old club sends "left", the new club "joined")');
  } catch (e) {
    report.push('Club updates: could not remove the "moved" section (' + e.message + '); remove it by hand, or leave it: moves sent are still approved');
  }
}

/**
 * The website's contact form, shown inside the Contact page. No Google sign-in, so anyone can write.
 * Messages go to the private Sheet and are emailed on to the district; the reply details are never published.
 */
function makeContactForm_() {
  var form = FormApp.create('Contact Rotary District 3110');
  form.setDescription('Write to Rotary District 3110. The district office reads every message. Your details are used only to reply to you.');
  form.setCollectEmail(false);
  form.setAllowResponseEdits(false);
  form.setConfirmationMessage('Thank you. Your message has reached the district office. Someone will reply to you.');
  form.addTextItem().setTitle(Q.kName).setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(80).setHelpText('Up to 80 characters').build());
  form.addTextItem().setTitle(Q.kReply).setRequired(true).setHelpText('Only the district office sees this. It is never shown on the website.')
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(100).setHelpText('Up to 100 characters').build());
  form.addListItem().setTitle(Q.kTopic).setChoiceValues(CONTACT_TOPICS).setRequired(true);
  form.addTextItem().setTitle(Q.kCity)
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(60).setHelpText('Up to 60 characters').build());
  form.addParagraphTextItem().setTitle(Q.kMessage).setRequired(true)
    // Google Forms patterns count to 1000 at most ({20,1500} is refused with "Invalid data updating form")
    .setValidation(FormApp.createParagraphTextValidation().requireTextMatchesPattern('^[\\s\\S]{20,1000}$')
      .setHelpText('Please write between 20 and 1,000 characters').build());
  return form;
}

/**
 * Each club's own link to the activity form with the club already chosen, kept in the clubs tab
 * (activity_form_link) for the district to send to club secretaries. Never published.
 */
function makeClubFormLinks_() {
  var ids = JSON.parse(props_().getProperty('FORM_IDS') || '{}');
  if (!ids.activity) return 0;
  var form = FormApp.openById(ids.activity);
  var clubItem = form.getItems().filter(function (it) { return it.getTitle() === Q.club; })[0];
  if (!clubItem) return 0;
  var ss = mainSs_();
  var sh = ss.getSheetByName('clubs');
  var headers = headers_(ss, 'clubs');
  var col = headers.indexOf('activity_form_link');
  if (col < 0 || sh.getLastRow() < 2) return 0;
  var rows = readTab_(ss, 'clubs');
  var values = [];
  for (var r = 2; r <= sh.getLastRow(); r++) values.push(['']);
  var made = 0;
  rows.forEach(function (c) {
    if (!Core_str(c.club_name) || Core_str(c.status || 'active') !== 'active') return;
    try {
      values[c._row - 2] = [form.createResponse().withItemResponse(clubItem.asListItem().createResponse(Core_str(c.club_name))).toPrefilledUrl()];
      made++;
    } catch (e) { /* a club name the form does not list yet: refreshed with the form lists */ }
  });
  sh.getRange(2, col + 1, values.length, 1).setValues(values);
  return made;
}

/**
 * Menu: refresh the club, area, profession and campaign lists in the forms after the clubs, lists or campaigns tabs
 * change. Also runs every morning, so campaigns drop off the form 30 days after they end.
 */
function updateFormLists(silent) {
  var ids = JSON.parse(props_().getProperty('FORM_IDS') || '{}');
  var L = formLists_();
  var lists = {};
  lists[Q.club] = L.clubs; lists[Q.cClub] = L.clubs; lists[Q.aPartners] = L.clubs; lists[Q.cSpouseClub] = L.clubs;
  lists[Q.eCity] = L.areas; lists[Q.cArea] = L.areas; lists[Q.cProfession] = L.professions; lists[Q.eOrganiser] = L.organisers;
  lists[Q.aCampaign] = L.campaigns; lists[Q.sCity] = L.areas; lists[Q.bCity] = L.areas; lists[Q.bTrade] = L.trades;
  lists[Q.gNewClub] = L.newClubs; lists[Q.gTeam] = L.teams; lists[Q.gClubYear] = L.years; lists[Q.gDistYear] = L.districtYears;
  Object.keys(ids).forEach(function (k) {
    var form = FormApp.openById(ids[k]);
    form.getItems().forEach(function (item) {
      var values = lists[item.getTitle()];
      if (!values) return;
      if (item.getType() === FormApp.ItemType.LIST) item.asListItem().setChoiceValues(values);
      if (item.getType() === FormApp.ItemType.CHECKBOX) item.asCheckboxItem().setChoiceValues(values);
    });
  });
  try { makeClubFormLinks_(); } catch (e) { Logger.log('Club form links not made: ' + e.message); }
  if (silent === true) return;
  try { SpreadsheetApp.getUi().alert('Form lists updated.'); } catch (e) { /* editor */ }
}
