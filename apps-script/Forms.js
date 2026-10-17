/**
 * The six Google Forms. Questions are found again by their titles, so keep titles in Q unchanged.
 * The activity, club profile and public service forms send answers to the main Sheet; the consent and removal
 * forms (members' personal details) and the website's contact form (visitors' reply details) to the private Sheet.
 * Each form's raw answers stay untouched in a "raw_…" tab; the script copies them into the working tabs.
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
};

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
  if (ids.activity) FormApp.openById(ids.activity).setDescription(activityDescription_());
}

var YES_NO = ['Yes', 'No'];
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
  return {
    clubs: activeClubs.length ? activeClubs : ['(clubs not loaded yet)'],
    areas: areas.length ? areas : ['(areas not loaded yet)'],
    professions: professions.length ? professions.concat(['Other']) : ['Other'],
    organisers: activeClubs.concat(teams.length ? teams : ["Governor's Office Team"]),
    roles: ['President', 'Secretary', 'Public Image Chair', 'Other office bearer', 'Member'],
    serviceTypes: CORE_SERVICE_TYPES.slice(),
    campaigns: [CORE_NO_CAMPAIGN].concat(Core_openCampaigns(readTab_(mainSs_(), 'campaigns'), today_()).map(Core_campaignLabel)),
  };
}

function createForms_(report) {
  var ids = JSON.parse(props_().getProperty('FORM_IDS') || '{}');
  var L = formLists_();
  var makers = { activity: makeActivityForm_, club_profile: makeClubProfileForm_, consent: makeConsentForm_, removal: makeRemovalForm_,
    public_service: makePublicServiceForm_, contact: makeContactForm_ };
  var destinations = { activity: mainSs_().getId(), club_profile: mainSs_().getId(), consent: CONFIG.PRIVATE_SHEET_ID, removal: CONFIG.PRIVATE_SHEET_ID,
    public_service: mainSs_().getId(), contact: CONFIG.PRIVATE_SHEET_ID };
  var rawNames = { activity: 'raw_activity_form', club_profile: 'raw_club_profile_form', consent: 'raw_consent_form', removal: 'raw_removal_form',
    public_service: 'raw_public_service_form', contact: 'raw_contact_form' };

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
    setSetting_('form_' + key + '_url', form.getPublishedUrl());
  });
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
  form.addParagraphTextItem().setTitle(Q.aDesc).setRequired(true)
    .setHelpText('Two to five lines. Please do not write the names of children.')
    .setValidation(FormApp.createParagraphTextValidation().requireTextMatchesPattern('^[\\s\\S]{100,600}$')
      .setHelpText('Please write between 100 and 600 characters (about 2–5 lines)').build());
  // The photo question is added here by hand (Google does not allow scripts to add file uploads)
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
  form.addCheckboxItem().setTitle(Q.aConsent).setRequired(true)
    .setChoiceValues(['Everyone in these photos (or their guardian) agreed to them being published.']);

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

function makeClubProfileForm_(L) {
  var form = baseForm_("Club profile – Rotary District 3110", CLUB_PROFILE_DESCRIPTION);
  addSender_(form, L);
  form.getItems()[2].asListItem().setChoiceValues(['President', 'Secretary', 'Other office bearer']);
  [Q.pWebsite, Q.pFacebook, Q.pInstagram, Q.pYoutube, Q.pX, Q.pLinkedin].forEach(function (t) {
    form.addTextItem().setTitle(t + ' (optional)').setValidation(urlRule_());
  });
  form.addTextItem().setTitle(Q.pMeeting + ' (optional)').setHelpText('For example: Every Tuesday, 7:30 pm, Hotel Grand, Agra');
  addLaterQuestion_(form, Q.pMeetingDay, L);
  addLaterQuestion_(form, Q.pProjects, L);
  addLaterQuestion_(form, Q.pServices, L);
  form.addCheckboxItem().setTitle(Q.pConfirm).setRequired(true)
    .setChoiceValues(['I am an office bearer of this club and these links belong to the club.']);
  return form;
}

function makeConsentForm_(L) {
  var form = baseForm_('Member consent – Rotary District 3110',
    'Choose what the district website may show about you. Each item is a separate choice, and you can change your mind at any time ' +
    'using the removal form. Birthdays and anniversaries are shown as day and month only, never the year.\n\n' +
    'DRAFT WORDING – to be checked by a lawyer before launch.');
  form.addListItem().setTitle(Q.cClub).setChoiceValues(L.clubs).setRequired(true);
  form.addTextItem().setTitle(Q.cName).setRequired(true);
  form.addTextItem().setTitle(Q.cMemberId).setHelpText('Helps us find your record. Never published.')
    .setValidation(FormApp.createTextValidation().requireWholeNumber().setHelpText('Numbers only').build());
  form.addTextItem().setTitle(Q.cMobile).setRequired(true)
    .setHelpText('Used to find your record. Shown only as a WhatsApp/call button, and only if you say Yes below.')
    .setValidation(textRule_(MOBILE_PATTERN, 'Please give a 10-digit mobile number'));
  form.addMultipleChoiceItem().setTitle(Q.cFilledBy).setChoiceValues(['The member', 'Club secretary for the member']).setRequired(true);

  form.addPageBreakItem().setTitle('Professional directory');
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
  return form;
}

function makeRemovalForm_(L) {
  var form = baseForm_('Remove my details – Rotary District 3110',
    'Ask for some or all of your details to be removed from the district website. A moderator acts within two days.');
  form.addListItem().setTitle(Q.rClub).setChoiceValues(L.clubs).setRequired(true);
  form.addTextItem().setTitle(Q.rName).setRequired(true);
  form.addTextItem().setTitle(Q.rMemberId).setValidation(FormApp.createTextValidation().requireWholeNumber().setHelpText('Numbers only').build());
  form.addTextItem().setTitle(Q.rMobile).setRequired(true).setValidation(textRule_(MOBILE_PATTERN, 'Please give a 10-digit mobile number'));
  form.addCheckboxItem().setTitle(Q.rItems).setRequired(true)
    .setChoiceValues(['Everything', 'Directory listing', 'WhatsApp / call button', 'My photo', 'Birthday', 'Anniversary', 'Couple photo']);
  form.addParagraphTextItem().setTitle(Q.rReason);
  return form;
}

/**
 * A blood bank, eye hospital, dialysis unit or similar that a club runs and the public can use. One per form.
 * The phone number is the facility's own; it is shown on the website with a tap-to-call link.
 */
function makePublicServiceForm_(L) {
  var form = baseForm_('Public service run by a club – Rotary District 3110',
    'For club office bearers: a lasting facility the public can use, such as a blood bank, eye hospital, dialysis unit, clinic, ' +
    'library, skill centre or ambulance. Send one form per facility. A moderator checks it before it appears on the website.');
  addSender_(form, L);
  form.getItems()[2].asListItem().setChoiceValues(['President', 'Secretary', 'Other office bearer']);
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
    .setValidation(FormApp.createParagraphTextValidation().requireTextMatchesPattern('^[\\s\\S]{20,1500}$')
      .setHelpText('Please write between 20 and 1,500 characters').build());
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
  lists[Q.aCampaign] = L.campaigns; lists[Q.sCity] = L.areas;
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
