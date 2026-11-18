/**
 * The four Google Forms (Release 2, 18 Nov 2026; there were eight): the activity form, the Club updates form (club
 * details, members and roles, a public service, as sections), the My details on the website form (show my details,
 * remove them, my business, as sections) and the website's contact form. Questions are found again by their titles,
 * so keep titles in Q unchanged. The activity form sends answers to the main Sheet; the other three to the private
 * Sheet. Each form's raw answers stay untouched in a "raw_…" tab; the script copies them into the working tabs.
 *
 * The six older forms (club profile, public service, club changes, consent, removal, business) still file their
 * answers while they exist; Upgrade Sheet closes them, and Administrator → Delete the old forms removes them.
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
};

// The first choice on each of the two forms with sections leads to its section
var CLUB_UPDATE_KINDS = {
  profile: "Our club's details: website, social pages, meeting day and place, projects and services",
  member: 'A member or a role: joined, left, moved, passed away, President, Secretary, Executive Secretary or a district role',
  service: 'A public service the club runs: blood bank, eye care, dialysis, ambulance…',
};
var MY_DETAILS_KINDS = {
  consent: 'Show my details on the website: directory, photo, birthday, anniversary',
  removal: 'Remove some or all of my details',
  business: 'List my business, or the topics I can speak on (Rotary Means Business)',
};
// The six forms Release 2 replaced, with their answer tabs, and the new form and section each one's link now opens
var OLD_FORMS = {
  club_profile: { raw: 'raw_club_profile_form', sheet: 'main', now: 'club_updates', kind: 'profile' },
  public_service: { raw: 'raw_public_service_form', sheet: 'main', now: 'club_updates', kind: 'service' },
  club_change: { raw: 'raw_club_change_form', sheet: 'private', now: 'club_updates', kind: 'member' },
  consent: { raw: 'raw_consent_form', sheet: 'private', now: 'my_details', kind: 'consent' },
  removal: { raw: 'raw_removal_form', sheet: 'private', now: 'my_details', kind: 'removal' },
  business: { raw: 'raw_business_form', sheet: 'main', now: 'my_details', kind: 'business' },
};
// The member's RI ID is required on the My details form: with the sender's own email, it is how the member is found (owner, 18 Nov 2026)
var MY_DETAILS_ID_HELP = "Your Rotary member ID, from My Rotary or your club's records. It is how we find your record. Never published.";
var CLUB_UPDATES_DESCRIPTION = 'Tell the district about your club: its details (website, social pages, meeting, projects and services), ' +
  'a member who joined, left, moved or passed away, a club or district role, or a public service the club runs. ' +
  "A district moderator checks everything before the website or the district's members list changes, and you get an email when it is decided.";
var MY_DETAILS_DESCRIPTION = 'Your details on the district website: choose what may be shown about you, ask for something to be removed, ' +
  'or list your business. Birthdays and anniversaries are shown as day and month only, never the year.\n\n' +
  'Sent from your own email (the one the district has for you), it is applied at the next website update. ' +
  'If someone else fills it in for you (for example your club secretary), we email you with what was asked, and a district moderator checks it first.';

// The club changes form's choices, by the change kept in club_change_requests
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
  if (ids.my_details) {
    // the RI member ID became required on the My details form (owner, 18 Nov 2026)
    FormApp.openById(ids.my_details).getItems().forEach(function (it) {
      if (it.getTitle() !== Q.cMemberId) return;
      var text = it.asTextItem();
      if (text.isRequired()) return;
      text.setRequired(true).setHelpText(MY_DETAILS_ID_HELP);
      report.push('The RI member ID is now required on the My details form');
    });
  }
  ['removal', 'my_details'].forEach(function (key) {
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
  };
}

function createForms_(report) {
  var ids = JSON.parse(props_().getProperty('FORM_IDS') || '{}');
  var L = formLists_();
  var makers = { activity: makeActivityForm_, contact: makeContactForm_, club_updates: makeClubUpdatesForm_, my_details: makeMyDetailsForm_ };
  var destinations = { activity: mainSs_().getId(), contact: privateSheetId_(), club_updates: privateSheetId_(), my_details: privateSheetId_() };
  var rawNames = { activity: 'raw_activity_form', contact: 'raw_contact_form', club_updates: 'raw_club_updates_form', my_details: 'raw_my_details_form' };

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
  Object.keys(OLD_FORMS).forEach(function (key) {
    var o = OLD_FORMS[key];
    var url = sectionLink_(o.now, o.kind);
    if (url) setSetting_('form_' + key + '_url', url);
  });
  closeOldForms_(ids, report);
}

/** A link to the Club updates or My details form with the first question already answered, so it opens at that section. */
function sectionLink_(formKey, kind) {
  var ids = JSON.parse(props_().getProperty('FORM_IDS') || '{}');
  if (!ids[formKey]) return '';
  var form = FormApp.openById(ids[formKey]);
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

/** The six older forms stop taking answers once the two new ones exist, and say where to go instead. Nothing is deleted. */
function closeOldForms_(ids, report) {
  if (!ids.club_updates || !ids.my_details) return;
  Object.keys(OLD_FORMS).forEach(function (key) {
    if (!ids[key]) return;
    var form;
    try { form = FormApp.openById(ids[key]); } catch (e) { return; }
    var now = OLD_FORMS[key].now === 'club_updates' ? 'Club updates' : 'My details on the website';
    var name = key.replace('_', ' ');
    // Google refused this message with the new form's prefilled link in it ("Invalid data updating form", 18 Nov 2026),
    // so it names the form and the website instead; the website's links already open the new form at the right section
    var message = 'This form has moved. Please use the "' + now + '" form, linked on the district website.';
    if (form.isAcceptingResponses()) {
      try {
        form.setAcceptingResponses(false);
      } catch (e) {
        report.push('Could not close the old ' + name + ' form (Google said: ' + e.message + '). Close it by hand: open the form, Responses, turn off Accepting responses');
        return;
      }
      report.push('Closed the old ' + name + ' form (it points to the ' + now + ' form)');
    }
    try {
      if (form.getCustomClosedFormMessage() !== message) form.setCustomClosedFormMessage(message);
    } catch (e) {
      report.push('The old ' + name + ' form is closed, but Google refused its "has moved" message (' + e.message + '); it shows Google\'s own closed message');
    }
  });
}

/**
 * Administrator → Delete the old forms and their answer tabs…: once the two new forms work, the six older forms go to
 * Google Drive's Bin (deleted for good after 30 days) and their raw answer tabs are deleted (owner, 18 Nov 2026).
 * What they filed stays in the working tabs (consent_requests, club_change_requests and so on).
 */
function deleteOldForms() {
  var ui = SpreadsheetApp.getUi();
  var out = deleteOldForms_(function (list) {
    return ui.alert('Delete the old forms', 'These forms go to the Bin and their answer tabs are deleted:\n\n' + list.join('\n') +
      '\n\nWhat they sent stays in the working tabs. Go ahead?', ui.ButtonSet.YES_NO) === ui.Button.YES;
  });
  ui.alert(out);
  return out;
}

function deleteOldForms_(confirm) {
  var ids = JSON.parse(props_().getProperty('FORM_IDS') || '{}');
  if (!ids.club_updates || !ids.my_details) return 'The two new forms are not set up yet: run Upgrade Sheet first.';
  var old = Object.keys(OLD_FORMS).filter(function (k) { return ids[k]; });
  if (!old.length) return 'The old forms are already gone.';
  if (!confirm(old.map(function (k) { return '• ' + k.replace('_', ' ') + ' form, tab ' + OLD_FORMS[k].raw; }))) return 'Nothing deleted.';
  var done = [];
  var byHand = [];
  old.forEach(function (key) {
    var o = OLD_FORMS[key];
    var name = key.replace('_', ' ');
    // Google keeps a tab linked to its form until the form lets go, and refuses to delete a linked tab (18 Nov 2026);
    // a closed old form may refuse to unlink, so the tab is unlinked by hand from the Sheet and this is run again
    var why = '';
    try { FormApp.openById(ids[key]).removeDestination(); } catch (e) { why = e.message; }
    SpreadsheetApp.flush();
    var ss = o.sheet === 'main' ? mainSs_() : privateSs_();
    var tab = ss.getSheetByName(o.raw);
    if (tab) {
      try {
        ss.deleteSheet(tab);
      } catch (e) {
        byHand.push('• ' + name + ' form' + (why ? ' (Google said: ' + why + ')' : '') + ': in the ' + (o.sheet === 'main' ? 'main' : 'private members') +
          ' Sheet open the tab ' + o.raw + ', choose Form → Unlink form, then run this again');
        return;
      }
    }
    ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getTriggerSourceId && t.getTriggerSourceId() === ids[key]) ScriptApp.deleteTrigger(t); });
    try { DriveApp.getFileById(ids[key]).setTrashed(true); } catch (e) { Logger.log('Form ' + key + ' not moved to the Bin: ' + e.message); }
    delete ids[key];
    props_().setProperty('FORM_IDS', JSON.stringify(ids));
    done.push(name);
  });
  var out = done.length ? 'Deleted: the ' + done.join(', ') + ' forms (in the Bin for 30 days) and their answer tabs.' : 'Nothing deleted yet.';
  if (byHand.length) out += '\n\nGoogle would not unlink these forms from their answer tabs. Please:\n' + byHand.join('\n');
  return out;
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

function addSender_(form, L) {
  form.addListItem().setTitle(Q.club).setChoiceValues(L.clubs).setRequired(true);
  form.addTextItem().setTitle(Q.name).setRequired(true);
  form.addListItem().setTitle(Q.role).setChoiceValues(L.roles).setRequired(true);
  form.addTextItem().setTitle(Q.mobile).setHelpText('Only moderators see this, to ask you a question. It is never published.')
    .setValidation(textRule_(MOBILE_PATTERN, 'Please give a 10-digit mobile number')).setRequired(true);
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
  change.setChoices(['joined', 'left', 'moved', 'deceased', 'club_role', 'district_role'].map(function (k) { return change.createChoice(CLUB_CHANGES[k], pages[k]); }));
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
  p.moved = form.addPageBreakItem().setTitle(CLUB_CHANGES.moved).setHelpText('The club chosen on the first page is the club the member left.');
  form.addListItem().setTitle(Q.gNewClub).setChoiceValues(L.newClubs).setRequired(true);
  form.addDateItem().setTitle(Q.gMoved).setRequired(true);
  p.deceased = form.addPageBreakItem().setTitle(CLUB_CHANGES.deceased);
  form.addDateItem().setTitle(Q.gDied);
  p.club_role = form.addPageBreakItem().setTitle(CLUB_CHANGES.club_role);
  form.addListItem().setTitle(Q.gClubYear).setChoiceValues(L.years).setRequired(true);
  form.addListItem().setTitle(Q.gClubRole).setChoiceValues(CORE_CLUB_ROLES.slice()).setRequired(true);
  p.district_role = form.addPageBreakItem().setTitle(CLUB_CHANGES.district_role)
    .setHelpText('The member may be from another club. Please say in the note who decided it, for example the Governor\'s letter.');
  form.addListItem().setTitle(Q.gDistYear).setChoiceValues(L.years).setRequired(true);
  form.addListItem().setTitle(Q.gTeam).setChoiceValues(L.teams).setRequired(true);
  form.addTextItem().setTitle(Q.gCommittee).setHelpText('As the district names it, for example District Social Media Management Committee');
  form.addTextItem().setTitle(Q.gRole).setRequired(true).setHelpText('For example: Chairman, Co-chairman, Member, Assistant Governor')
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(60).setHelpText('Up to 60 characters').build());
  var note = form.addPageBreakItem().setTitle('Anything else');
  form.addParagraphTextItem().setTitle(Q.gNote)
    .setValidation(FormApp.createParagraphTextValidation().requireTextLengthLessThanOrEqualTo(500).setHelpText('Up to 500 characters').build());
  // each kind's page goes on to the note (a page break's "go to" applies at the end of the page before it)
  [p.left, p.moved, p.deceased, p.club_role, p.district_role].forEach(function (x) { x.setGoToPage(note); });
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
 * My details on the website (Release 2): the consent, removal and business forms in one. Page 1 finds the member
 * (club, name, member ID, mobile, who is filling it) and asks what they want; each section ends the form. The
 * "My photo", "Couple photo" and "Logo or shop photo (optional)" upload questions are added by hand (Google does not
 * let scripts add uploads), in the Photo, Celebrations and Your business sections.
 */
function makeMyDetailsForm_(L) {
  var form = baseForm_('My details on the website – Rotary District 3110', MY_DETAILS_DESCRIPTION);
  form.addListItem().setTitle(Q.cClub).setChoiceValues(L.clubs).setRequired(true);
  form.addTextItem().setTitle(Q.cName).setRequired(true);
  form.addTextItem().setTitle(Q.cMemberId).setRequired(true).setHelpText(MY_DETAILS_ID_HELP)
    .setValidation(FormApp.createTextValidation().requireWholeNumber().setHelpText('Numbers only').build());
  form.addTextItem().setTitle(Q.cMobile).setRequired(true)
    .setHelpText('Shown only as a WhatsApp/call button, and only if you say Yes to it. Never shown otherwise.')
    .setValidation(textRule_(MOBILE_PATTERN, 'Please give a 10-digit mobile number'));
  form.addMultipleChoiceItem().setTitle(Q.cFilledBy).setChoiceValues(['The member', 'Club secretary for the member']).setRequired(true);
  var kind = form.addMultipleChoiceItem().setTitle(Q.mKind).setRequired(true);

  var directory = form.addPageBreakItem().setTitle('Professional directory');
  form.addMultipleChoiceItem().setTitle(Q.cDirectory).setChoiceValues(YES_NO).setRequired(true);
  form.addListItem().setTitle(Q.cProfession).setChoiceValues(L.professions).setHelpText('Only if you said Yes above');
  form.addListItem().setTitle(Q.cArea).setChoiceValues(L.areas).setHelpText('Only if you said Yes above');
  form.addTextItem().setTitle(Q.cWhat).setHelpText('Only if you said Yes above. About 20 words.')
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(150).setHelpText('Up to 150 characters').build());
  form.addTextItem().setTitle(Q.cWebsite).setValidation(urlRule_());
  form.addCheckboxItem().setTitle(Q.cSpotlight).setChoiceValues(["I'm happy to be considered for the monthly member spotlight."]);
  form.addMultipleChoiceItem().setTitle(Q.cContact).setChoiceValues(YES_NO).setRequired(true);
  form.addPageBreakItem().setTitle('Photo');
  form.addMultipleChoiceItem().setTitle(Q.cPhoto).setChoiceValues(YES_NO).setRequired(true)
    .setHelpText('If Yes, upload a head-and-shoulders photo of you alone below, or the district may use one it already has.');
  // "My photo" upload question is added here by hand
  form.addPageBreakItem().setTitle('Celebrations');
  form.addMultipleChoiceItem().setTitle(Q.cBirthday).setChoiceValues(YES_NO).setRequired(true);
  form.addDateItem().setTitle(Q.cBirthdayDate).setIncludesYear(false).setHelpText('Day and month only. Only if you said Yes above.');
  form.addMultipleChoiceItem().setTitle(Q.cAnniversary).setChoiceValues(YES_NO).setRequired(true)
    .setHelpText('Shown only if both spouses agree. If your spouse is a Rotarian, they must also send their own form.');
  form.addMultipleChoiceItem().setTitle(Q.cSpouseRotarian).setChoiceValues(YES_NO);
  form.addTextItem().setTitle(Q.cSpouseName).setHelpText('If your spouse is not a Rotarian, only the first name is shown.');
  form.addListItem().setTitle(Q.cSpouseClub).setChoiceValues(L.clubs);
  form.addTextItem().setTitle(Q.cSpouseId).setValidation(FormApp.createTextValidation().requireWholeNumber().setHelpText('Numbers only').build());
  form.addCheckboxItem().setTitle(Q.cSpouseAgrees).setChoiceValues(['My spouse has also agreed to our anniversary being shown.']);
  form.addDateItem().setTitle(Q.cAnniversaryDate).setIncludesYear(false).setHelpText('Day and month only.');
  // "Couple photo" upload question is added here by hand
  form.addCheckboxItem().setTitle(Q.cCoupleAgree)
    .setChoiceValues(['I agree to the couple photo being shown on our anniversary card (and, if my spouse is not a Rotarian, my spouse agrees too).']);
  form.addPageBreakItem().setTitle('Declaration');
  form.addCheckboxItem().setTitle(Q.cDeclaration).setRequired(true)
    .setChoiceValues(['The member has agreed to every choice above. (If filled by the club secretary: the member agreed to each item.)']);

  var removal = form.addPageBreakItem().setTitle('Remove my details');
  form.addCheckboxItem().setTitle(Q.rItems).setRequired(true).setChoiceValues(REMOVAL_ITEMS);
  form.addParagraphTextItem().setTitle(Q.rReason);

  var business = form.addPageBreakItem().setTitle('Your business').setHelpText(BUSINESS_DESCRIPTION + '\n\nLeave this page blank if you only want to be listed as a speaker.');
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
  form.addPageBreakItem().setTitle('Speaking at clubs');
  form.addParagraphTextItem().setTitle(Q.bTopics)
    .setHelpText('Clubs look for speakers for their meetings. For example: Income tax for families; First aid at home. Leave blank if not.')
    .setValidation(FormApp.createParagraphTextValidation().requireTextLengthLessThanOrEqualTo(300).setHelpText('Up to 300 characters').build());
  form.addPageBreakItem().setTitle('Confirmation');
  form.addCheckboxItem().setTitle(Q.bConfirm).setRequired(true)
    .setChoiceValues(['I am a member of this club, this is my own business (or one I am a partner in), and I agree to my name, club and these details being shown on the district website.']);

  kind.setChoices([kind.createChoice(MY_DETAILS_KINDS.consent, directory), kind.createChoice(MY_DETAILS_KINDS.removal, removal),
    kind.createChoice(MY_DETAILS_KINDS.business, business)]);
  removal.setGoToPage(FormApp.PageNavigationType.SUBMIT); // the consent section ends the form
  business.setGoToPage(FormApp.PageNavigationType.SUBMIT); // the removal section ends the form
  form.setConfirmationMessage('Thank you! Sent from your own email, it is applied at the next website update and you get an email. ' +
    'Otherwise a district moderator checks it first.');
  return form;
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
  lists[Q.gNewClub] = L.newClubs; lists[Q.gTeam] = L.teams; lists[Q.gClubYear] = L.years; lists[Q.gDistYear] = L.years;
  Object.keys(ids).forEach(function (k) {
    var form = FormApp.openById(ids[k]);
    if (OLD_FORMS[k] && !form.isAcceptingResponses()) return; // a closed old form needs no fresh lists
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
