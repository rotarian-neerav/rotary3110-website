/**
 * Form submissions: each answer is copied from the untouched raw tab into a working tab with
 * status "pending". Nothing goes live until a moderator approves it.
 */

function onAnyFormSubmit(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  AFTER_FILING = [];
  try {
    var ids = JSON.parse(props_().getProperty('FORM_IDS') || '{}');
    var formId = e.source.getId();
    var answers = answersOf_(e.response);
    var meta = {
      submitted_at: e.response.getTimestamp().toISOString(),
      submitter_email: e.response.getRespondentEmail() || '',
    };
    if (formId === ids.activity) fileActivityOrEvent_(answers, meta);
    else if (formId === ids.contact) fileContact_(answers, meta);
    // the two forms with sections (Release 2): each section is filed by the code its old form used
    else if (formId === ids.club_updates) fileClubUpdates_(answers, meta);
    else if (ids.my_details && formId === ids.my_details) fileMyDetails_(answers, meta); // closed 23 Nov 2026; any answer still sent is filed as before
    else if (formId === ids.show_details) fileShowDetails_(answers, meta);
    else if (formId === ids.update_details) fileUpdateDetails_(answers, meta);
  } finally {
    lock.releaseLock();
  }
  // a member's own update is applied once the answer is filed and the lock is free (the approvals take it themselves)
  var jobs = AFTER_FILING;
  AFTER_FILING = [];
  jobs.forEach(function (job) { job(); });
}

var AFTER_FILING = [];

/** {question title: answer}. File uploads give an array of Drive file IDs. */
function answersOf_(response) {
  var out = {};
  response.getItemResponses().forEach(function (ir) {
    out[ir.getItem().getTitle()] = ir.getResponse();
  });
  return out;
}

function firstStartingWith_(answers, prefix) {
  var key = Object.keys(answers).filter(function (k) { return k.indexOf(prefix) === 0; })[0];
  return key ? answers[key] : '';
}

function fileIds_(value) {
  if (!value) return '';
  return (Array.isArray(value) ? value : [value]).map(function (id) { return 'drive:' + id; }).join(', ');
}

/** "aol.com/post" -> "https://aol.com/post", so links people type without https:// still work. */
function link_(value) {
  var s = Core_str(value);
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : 'https://' + s.replace(/^\/+/, '');
}

function checked_(value) {
  return Array.isArray(value) ? value.length > 0 : !!Core_str(value);
}

function yes_(value) {
  return Core_str(value).toLowerCase() === 'yes';
}

/** A no-year date answer comes as "MM-DD"; stored as "DD-MM", the way people in India write it. */
function dayMonthAnswer_(value) {
  var s = Core_str(value);
  var m = s.match(/^(?:\d{4}-)?(\d{2})-(\d{2})$/);
  return m ? m[2] + '-' + m[1] : '';
}

/** Moderator notes for free text that must not be published as it is. */
function textNotes_(values, notes) {
  if (values.some(function (v) { return Core_unsafeText(Core_str(v)); })) notes.push('Contains a phone number or email: remove it before approving');
  if (values.some(function (v) { return Core_str(v).split(/\r?\n/).some(function (l) { return l.trim().length > CORE_LINE_MAX; }); })) {
    notes.push('A line is longer than ' + CORE_LINE_MAX + ' characters');
  }
}

function fileActivityOrEvent_(a, meta) {
  var ss = mainSs_();
  var clubName = Core_str(a[Q.club]);
  var sender = {
    submitted_at: meta.submitted_at, submitter_email: meta.submitter_email, submitter_name: Core_str(a[Q.name]),
    submitter_role: Core_str(a[Q.role]), submitter_mobile: Core_str(a[Q.mobile]), status: 'pending', source: 'form',
  };
  if (Core_str(a[Q.kind]) === Q.kindEvent) {
    var events = readTab_(ss, 'events');
    var fee = Core_str(a[Q.eFee]);
    var eventNotes = [];
    if (Core_unsafeText(fee) || CORE_PAYMENT_RE.test(fee)) eventNotes.push('Fee contains payment details: remove before approving');
    if (Core_str(a[Q.eType]) === 'District event') eventNotes.push(DISTRICT_CHECK);
    var ev = Object.assign(sender, {
      id: nextId_(events, 'EVT-' + new Date().getFullYear() + '-'),
      title: Core_str(a[Q.eTitle]), event_type: Core_str(a[Q.eType]), start_date: Core_str(a[Q.eStart]),
      start_time: Core_str(a[Q.eTime]), end_date: Core_str(a[Q.eEnd]), venue: Core_str(a[Q.eVenue]), city: Core_str(a[Q.eCity]),
      organiser: Core_str(a[Q.eOrganiser]) || clubName, description: Core_str(a[Q.eDesc]), map_link: link_(a[Q.eMap]),
      details_link: link_(a[Q.eDetails]),
      // the event page has its own photo question with the same title; only one of the two is ever answered
      photo_files: fileIds_(firstStartingWith_(a, 'Photos')),
      registration_close_date: Core_str(a[Q.eRegClose]), fee: fee, moderator_note: eventNotes.join('; '),
      open_to_all: Core_str(a[Q.eOpen]) ? yes_(a[Q.eOpen]) : '',
    });
    fileGated_(ss, 'events', ev, clubIdByName_(clubName), function () { alertContent_('events', ev); });
    return;
  }
  var activities = readTab_(ss, 'activities');
  var partners = (a[Q.aPartners] || []).map(clubIdByName_).filter(function (id) { return id; });
  var row = Object.assign(sender, {
    id: nextId_(activities, 'ACT-' + new Date().getFullYear() + '-'),
    club_id: clubIdByName_(clubName), club_name: clubName,
    title: Core_str(a[Q.aTitle]), date: Core_str(a[Q.aDate]), theme: Core_str(a[Q.aTheme]), description: Core_str(a[Q.aDesc]),
    photo_files: fileIds_(firstStartingWith_(a, 'Photos')), post_link: link_(a[Q.aLink]),
    people_helped: Core_str(a[Q.aHelped]), amount_spent: Core_str(a[Q.aSpent]), partner_clubs: partners.join(', '),
    photo_consent: checked_(a[Q.aConsent]),
    avenue: Core_str(a[Q.aAvenue]), video_link: link_(a[Q.aVideo]),
    press_paper: Core_str(a[Q.aPressPaper]), press_date: Core_str(a[Q.aPressDate]), press_link: link_(a[Q.aPressLink]),
    district_level: Core_str(a[Q.aDistrict]) ? yes_(a[Q.aDistrict]) : '',
    // the two upload questions are added by hand; only the first file of each is used
    before_photo: fileIds_(firstStartingWith_(a, 'Before photo')), after_photo: fileIds_(firstStartingWith_(a, 'After photo')),
  });
  var campaignRows = readTab_(ss, 'campaigns');
  var count = Core_str(a[Q.aCampaignCount]).replace(/[,\s]/g, '');
  row.campaign_id = Core_campaignIdForLabel(a[Q.aCampaign], campaignRows);
  row.campaign_count = /^\d+$/.test(count) ? Number(count) : '';
  var notes = [];
  campaignNotes_(row, activities, campaignRows, notes);
  var dup = Core_findDuplicate(row, activities);
  if (dup) notes.push('Possible duplicate of ' + dup);
  if (!row.photo_files && !row.post_link) notes.push('No photo or link: reject or ask the club for one');
  if (Core_isoDate(row.date) > today_()) notes.push('Date is in the future');
  if (row.district_level === true) notes.push(DISTRICT_CHECK);
  if (row.before_photo || row.after_photo) {
    notes.push(row.before_photo && row.after_photo ? 'Before and after photos: check they show the same place, not people'
      : 'Only one of the before and after photos: it is not shown (both are needed)');
  }
  if (Core_looksLikeUrl(row.press_paper)) {
    // a web address typed as the newspaper's name: keep it as the link, and ask for the name
    if (!row.press_link) row.press_link = link_(row.press_paper);
    row.press_paper = '';
    notes.push('The newspaper name was a web address: it is now the newspaper link; please add the newspaper\'s name');
  } else if (row.press_link && !row.press_paper) notes.push('Press link without the newspaper\'s name: add it in press_paper');
  if (row.video_link && !Core_videoLink(row.video_link)) notes.push('Video link is not a web address');
  if (!row.club_id) notes.push('Club not recognised: fill in club_id before approving');
  if ((row.photo_files || row.before_photo || row.after_photo) && !row.photo_consent) notes.push('Photo consent not ticked');
  textNotes_([row.press_paper], notes);
  row.moderator_note = notes.join('; ');
  fileGated_(ss, 'activities', row, row.club_id, function () { alertContent_('activities', row); });
}

// The "District" mark puts an item first on the home page and in the bulletin, so a moderator checks it (owner, 17 Nov 2026)
var DISTRICT_CHECK = 'Marked as district level: check the district organised it or it was a district occasion (the Governor need not have been there); ' +
  'if not, change it before approving';

/** Notes for a campaign report: a count without a campaign, a date outside it, a large count, another club the same day. */
function campaignNotes_(row, activities, campaignRows, notes) {
  if (row.campaign_count !== '' && !row.campaign_id) notes.push('Count given without a campaign');
  if (!row.campaign_id) return;
  var c = Core_openCampaigns(campaignRows, '0000-00-00').filter(function (x) { return x.campaign_id === row.campaign_id; })[0];
  var date = Core_isoDate(row.date);
  if (c && !Core_inCampaign(c, date)) notes.push('Date is outside the campaign period: it will not count');
  var limit = Number(settings_().campaign_check_above) || 1000;
  if (row.campaign_count !== '' && row.campaign_count > limit) notes.push('Check the campaign count');
  var other = activities.filter(function (x) {
    return Core_str(x.campaign_id) === row.campaign_id && Core_isoDate(x.date) === date && Core_str(x.club_id) !== row.club_id &&
      Core_str(x.status).toLowerCase() !== 'rejected';
  })[0];
  if (other) {
    notes.push('Another club reported this campaign on the same date (' + other.id + ', ' + Core_str(other.club_name) +
      '): check it is not one joint event counted twice');
  }
}

/** Club updates (Release 2): the first answer says which section was filled; the old forms' filing does the rest. */
function fileClubUpdates_(a, meta) {
  var kind = Core_str(a[Q.uKind]);
  if (kind === CLUB_UPDATE_KINDS.profile) return fileClubProfile_(a, meta);
  if (kind === CLUB_UPDATE_KINDS.service) return filePublicService_(a, meta);
  var b = Object.assign({}, a);
  b[Q.cClub] = a[Q.club]; // the club changes section takes the club from page 1
  return fileClubChange_(b, meta);
}

/** My details on the website (Release 2, closed 23 Nov 2026): consent, removal or a business listing, with page 1's member details. */
function fileMyDetails_(a, meta) {
  var kind = Core_str(a[Q.mKind]);
  var b = Object.assign({}, a);
  if (kind === MY_DETAILS_KINDS.removal) {
    b[Q.rName] = a[Q.cName];
    return fileRemoval_(b, meta);
  }
  if (kind === MY_DETAILS_KINDS.business) {
    b[Q.club] = a[Q.cClub]; b[Q.name] = a[Q.cName]; b[Q.bMemberId] = a[Q.cMemberId]; b[Q.bMobile] = a[Q.cMobile];
    return fileBusiness_(b, meta);
  }
  return fileConsent_(a, meta);
}

/* ---------- The two My details forms (owner, 23 Nov 2026) ---------- */

/** Show my details: List or Do not list for each thing the website can show. */
function fileShowDetails_(a, meta) {
  var grid = a[Q.showGrid] || [];
  var said = {};
  Object.keys(SHOW_ITEMS).forEach(function (k, i) {
    var v = Core_str(Array.isArray(grid) ? grid[i] : '');
    said[k] = v === SHOW_COLUMNS[0] ? true : v === SHOW_COLUMNS[1] ? false : '';
  });
  var req = detailsRequest_(a, meta, 'show');
  Object.assign(req, {
    directory_ok: said.directory, profession_ok: said.profession, photo_ok: said.photo, birthday_ok: said.birthday,
    anniversary_ok: said.anniversary, couple_photo_ok: said.couple_photo, call_ok: said.call, contact_ok: said.whatsapp,
    spotlight_ok: said.spotlight,
  });
  var notes = [];
  if (Object.keys(said).some(function (k) { return said[k] === ''; })) notes.push('Not every item was answered: the unanswered ones are taken as Do not list');
  fileDetails_(req, notes);
}

/** Update my details: the details themselves (blank: no change), and the business listing. */
function fileUpdateDetails_(a, meta) {
  var spouseRotarian = yes_(a[Q.cSpouseRotarian]);
  var req = detailsRequest_(a, meta, 'update');
  Object.assign(req, {
    profession: Core_str(a[Q.cProfession]), area: Core_str(a[Q.cArea]), description: Core_str(a[Q.cWhat]), website: link_(a[Q.cWebsite]),
    call_number: Core_str(a[Q.uCall]), whatsapp_number: Core_str(a[Q.uWhatsapp]), email2: Core_str(a[Q.uEmail2]).trim().toLowerCase(),
    birthday: dayMonthAnswer_(a[Q.cBirthdayDate]), photo_file: fileIds_(firstStartingWith_(a, 'My photo')),
    anniversary: dayMonthAnswer_(a[Q.cAnniversaryDate]), spouse_is_rotarian: spouseRotarian ? 'Yes' : (Core_str(a[Q.cSpouseRotarian]) ? 'No' : ''),
    spouse_name: Core_str(a[Q.cSpouseName]), spouse_club_id: spouseRotarian ? clubIdByName_(a[Q.cSpouseClub]) : '',
    spouse_member_id: Core_str(a[Q.cSpouseId]), spouse_agrees: checked_(a[Q.cSpouseAgrees]),
    couple_photo_file: fileIds_(firstStartingWith_(a, 'Couple photo')), couple_photo_spouse_agrees: checked_(a[Q.cCoupleAgree]),
    remove_business: Core_str(a[Q.uBusiness]) === BUSINESS_CHOICES.remove,
  });
  var notes = [];
  if (req.call_number && !Core_mobile(req.call_number)) notes.push('The Call number is not a 10-digit mobile: it will not be saved');
  if (req.whatsapp_number && !Core_mobile(req.whatsapp_number)) notes.push('The WhatsApp number is not a 10-digit mobile: it will not be saved');
  if (req.anniversary && spouseRotarian && !Core_str(req.spouse_member_id)) notes.push("The spouse is a Rotarian but no member ID was given: the anniversary cannot be linked");
  textNotes_([req.description], notes);
  var hasDetails = ['profession', 'area', 'description', 'website', 'call_number', 'whatsapp_number', 'email2', 'birthday', 'photo_file',
    'anniversary', 'spouse_name', 'couple_photo_file'].some(function (k) { return Core_str(req[k]); }) || req.remove_business;
  var business = Core_str(a[Q.uBusiness]) === BUSINESS_CHOICES.list;
  var found = detailsMatch_(req);
  var lost = !found.club && !found.member; // the member's own form that finds nobody is not applied, business included
  if (hasDetails || !business || lost) found = fileDetails_(req, notes);
  if (!business || lost) return;
  var b = Object.assign({}, a);
  b[Q.club] = found && found.member ? clubNameById_(found.member.club_id) : '';
  b[Q.name] = found && found.member ? Core_str(found.member.name) : Core_str(req.name);
  fileBusiness_(b, meta, found || { member: null, own: false });
}

/** The parts both My details forms share: who filled it, and for a club office bearer, which member. */
function detailsRequest_(a, meta, form) {
  var club = Core_filledByClub(a[Q.cFilledBy]);
  return {
    id: '', submitted_at: meta.submitted_at, submitter_email: Core_str(meta.submitter_email).toLowerCase(), form: form,
    filled_by: Core_str(a[Q.cFilledBy]) || FILLED_BY.member, club_id: '', name: club ? Core_str(a[Q.rName]) : '',
    member_id: club ? Core_str(a[Q.gMemberId]).trim() : '', declaration: checked_(a[Q.cDeclaration]), status: 'pending',
  };
}

/** The member a My details request is for: { member, own (sent from the member's own email), count (members with that email) }. */
function detailsMatch_(req) {
  var master = readTab_(privateSs_(), 'members_master');
  var club = Core_filledByClub(req.filled_by);
  var i = Core_matchMember(req, master);
  return { member: i >= 0 ? master[i] : null, own: !club && i >= 0, club: club,
    count: club ? (i >= 0 ? 1 : 0) : Core_findByEmail(req.submitter_email, master).count };
}

/**
 * Files a My details request. The member's own (found by their email): applied at once after filing; not found: kept
 * as not_matched, nothing applied, and the sender is told why (owner, 23 Nov 2026: dropped, no moderator). Filled in by
 * the club: the member is told at every email they have, the sender gets a receipt, and a Members moderator decides.
 */
function fileDetails_(req, notes) {
  var ps = privateSs_();
  var found = detailsMatch_(req);
  var m = found.member;
  req.id = nextId_(readTab_(ps, 'consent_requests'), 'CON-');
  if (m) {
    req.matched_member_id = Core_str(m.member_id);
    req.club_id = Core_str(m.club_id);
    if (!found.club) req.name = Core_str(m.name);
    if (req.email2 && Core_emailOwners(req.email2, readTab_(ps, 'members_master'), m.member_id).length) {
      notes.push('The second email is already used by another member: it will not be saved');
    }
  }
  if (!found.club && !m) {
    req.status = 'not_matched';
    req.moderator_note = found.count > 1 ? 'This email belongs to more than one member: not applied' : 'No member has this email on file: not applied';
    appendRow_(ps, 'consent_requests', req);
    detailsNotFound_(req, found.count);
    return found;
  }
  if (found.club && !m) notes.push('No member has this Rotary member ID: reject, and ask the club to check the ID');
  req.moderator_note = notes.join('; ');
  var row = appendRow_(ps, 'consent_requests', req);
  if (found.own) {
    updateRow_(ps, 'consent_requests', row, { member_notice: "Not needed: sent from the member's own email" });
    AFTER_FILING.push(function () {
      try {
        approveConsent_(req.id, AUTO_BY, false);
      } catch (e) {
        updateRow_(ps, 'consent_requests', row, { moderator_note: (req.moderator_note ? req.moderator_note + '; ' : '') + 'Not applied by itself: ' + e.message });
        alertMembers_('consent', req);
      }
    });
    return found;
  }
  updateRow_(ps, 'consent_requests', row, { member_notice: noticeMember_(ps, req) });
  detailsReceipt_(req, m);
  alertMembers_('consent', req);
  return found;
}

/** The member's own form found nobody: they are told which email was used and how to be found (nothing is kept pending). */
function detailsNotFound_(req, count) {
  var to = Core_str(req.submitter_email);
  if (!to || !deskQuota_(1)) return;
  var why = count > 1 ? 'The email ' + to + ' belongs to more than one member in the district\'s list, so we cannot tell which member you are.'
    : 'We could not find a member with the email ' + to + ' in the district\'s list.';
  try {
    MailApp.sendEmail(to, 'Your form to the Rotary District 3110 website was not applied',
      'Thank you for your form.\n\n' + why + ' Nothing was changed.\n\n' +
      "Please ask your club's President, Secretary or Executive Secretary to give this email as your second email on the Update my details form" +
      (Core_str(settings_().form_update_url) ? ' (' + Core_str(settings_().form_update_url) + ')' : '') +
      '. Once that is done, send your form again from this email.\n\nRotary District 3110', { name: 'Rotary District 3110' });
  } catch (e) {
    Logger.log('Not-found email failed: ' + e.message);
  }
}

/** A receipt to the club office bearer who filled in a My details form for a member. */
function detailsReceipt_(req, m) {
  var to = Core_str(req.submitter_email);
  if (!to || !deskQuota_(1)) return;
  try {
    MailApp.sendEmail(to, 'Received: ' + (req.form === 'show' ? 'Show my details' : 'Update my details') + ' for ' + (m ? m.name : req.name),
      'Thank you. We received the form you filled in for ' + (m ? m.name + ' (' + m.member_id + ')' : req.name + ' (member ID ' + req.member_id + ', not found in the list)') +
      '.\n\nIt asks:\n' + detailsLines_(req).map(function (l) { return '- ' + l; }).join('\n') +
      '\n\nThe member is told by email, and a district moderator checks it before anything changes. You get an email when it is decided.' +
      '\n\nRotary District 3110', { name: 'Rotary District 3110' });
  } catch (e) {
    Logger.log('Receipt failed: ' + e.message);
  }
}

/**
 * Release 2 (owner, 18 Nov 2026): a member's own update goes live by itself when the form came from the member's own
 * Google account, the email the members list holds for them. Sent by anyone else (or matched only by a typed mobile
 * number, which anyone could type) it waits for a Members moderator, as before.
 */
var AUTO_BY = 'automatic: sent from the member\'s own email';

function fileClubProfile_(a, meta) {
  var ss = mainSs_();
  var clubName = Core_str(a[Q.club]);
  var ans = function (t) { return Core_str(a[t + ' (optional)']); };
  var url = function (t) { return link_(a[t + ' (optional)']); };
  var projects = Core_str(a[Q.pProjects]);
  var services = Core_str(a[Q.pServices]);
  var notes = [];
  textNotes_([projects, services], notes);
  var req = {
    id: nextId_(readTab_(ss, 'club_profile_requests'), 'CPR-'), submitted_at: meta.submitted_at, submitter_email: meta.submitter_email,
    submitter_name: Core_str(a[Q.name]), submitter_role: Core_str(a[Q.role]), submitter_mobile: Core_str(a[Q.mobile]),
    club_id: clubIdByName_(clubName), club_name: clubName, website: url(Q.pWebsite), facebook: url(Q.pFacebook),
    instagram: url(Q.pInstagram), youtube: url(Q.pYoutube), x: url(Q.pX), linkedin: url(Q.pLinkedin),
    meeting_day_place: ans(Q.pMeeting), permanent_projects: projects, regular_services: services, status: 'pending',
    meeting_day: Core_str(a[Q.pMeetingDay]), moderator_note: notes.join('; '),
  };
  fileGated_(ss, 'club_profile_requests', req, req.club_id, function () { alertContent_('club_profile_requests', req); });
}

/** A facility the public can use: filed as pending, with notes on anything the moderator should check. */
function filePublicService_(a, meta) {
  var ss = mainSs_();
  var clubName = Core_str(a[Q.club]);
  var phone = Core_str(a[Q.sPhone]);
  var notes = [];
  if (!Core_servicePhone(phone)) notes.push('The phone number is not a plain number: correct it before approving');
  else if (Core_mobile(phone)) notes.push('The phone number is a mobile: check it is the facility\'s own number, not a member\'s');
  textNotes_([a[Q.sName], a[Q.sTimings], a[Q.sAddress], a[Q.sAbout]], notes);
  var service = {
    id: nextId_(readTab_(ss, 'public_services'), 'SRV-'), submitted_at: meta.submitted_at, submitter_email: meta.submitter_email,
    submitter_name: Core_str(a[Q.name]), submitter_role: Core_str(a[Q.role]), submitter_mobile: Core_str(a[Q.mobile]),
    club_id: clubIdByName_(clubName), club_name: clubName, name: Core_str(a[Q.sName]), service_type: Core_str(a[Q.sType]),
    timings: Core_str(a[Q.sTimings]), phone: phone, address: Core_str(a[Q.sAddress]), city: Core_str(a[Q.sCity]),
    map_link: link_(a[Q.sMap]), about: Core_str(a[Q.sAbout]), status: 'pending', moderator_note: notes.join('; '),
  };
  fileGated_(ss, 'public_services', service, service.club_id, function () { alertContent_('public_services', service); });
}

/**
 * Rotary Means Business: a member's own business, the topics they can speak on, or both. The sender is looked up
 * in the private members list now, so the moderator sees who it is; approving needs an active member (members only).
 */
function fileBusiness_(a, meta, found) {
  var ss = mainSs_();
  var clubName = Core_str(a[Q.club]);
  var whatsapp = Core_str(a[Q.bWhatsapp]);
  var row = {
    id: nextId_(readTab_(ss, 'businesses'), 'BIZ-'), submitted_at: meta.submitted_at, submitter_email: meta.submitter_email,
    submitter_name: Core_str(a[Q.name]), submitter_mobile: Core_str(a[Q.bMobile]), club_id: clubIdByName_(clubName), club_name: clubName,
    member_id: '', member_name: '', business_name: Core_str(a[Q.bName]), trade: Core_str(a[Q.bTrade]), city: Core_str(a[Q.bCity]),
    about: Core_str(a[Q.bAbout]), offer: Core_str(a[Q.bOffer]), website: link_(a[Q.bWebsite]), whatsapp: whatsapp,
    photo_files: fileIds_(firstStartingWith_(a, 'Logo')), speaker_topics: Core_str(a[Q.bTopics]), status: 'pending',
  };
  var notes = [];
  var m;
  if (found) {
    // Update my details (23 Nov 2026): the member was found by their own email, or by the ID the club gave
    m = found.member;
  } else {
    var master = readTab_(privateSs_(), 'members_master');
    var i = Core_matchMember({ member_id: Core_str(a[Q.bMemberId]), mobile: row.submitter_mobile, club_id: row.club_id,
      filled_by: Core_str(a[Q.cFilledBy]), submitter_email: meta.submitter_email }, master);
    m = i >= 0 ? master[i] : null;
  }
  var own = !!m && Core_memberEmails(m).indexOf(Core_str(meta.submitter_email).toLowerCase()) >= 0;
  if (m && businessMemberActive_(m)) {
    row.member_id = Core_str(m.member_id);
    row.member_name = Core_str(m.name);
    row.club_id = Core_str(m.club_id) || row.club_id;
    row.club_name = clubNameById_(row.club_id) || row.club_name;
    if (!own) notes.push("Not sent from the member's own email: check with the member before approving");
  } else {
    notes.push(m ? 'The member is not active in the members list: members only' :
      'Not found in the members list: fill in member_id (and member_name) before approving, or reject (members only)');
  }
  if (!row.business_name && !row.speaker_topics) notes.push('Neither a business nor speaker topics: reject');
  if (row.business_name && (!row.trade || !row.city)) notes.push('Business without a trade or city: add them before approving');
  if (whatsapp && !Core_mobile(whatsapp)) notes.push('The WhatsApp number is not a mobile number: correct or clear it');
  textNotes_([row.business_name, row.about, row.offer, row.speaker_topics], notes);
  var older = businessOlder_(readTab_(ss, 'businesses'), row);
  if (older) notes.push('Updates ' + older.id + ': approving replaces it');
  row.moderator_note = notes.join('; ');
  row._row = appendRow_(ss, 'businesses', row);
  // the member's own listing from their own email, with nothing to check, goes live by itself (Release 2)
  var onlyReplaces = notes.every(function (n) { return /^Updates BIZ-/.test(n); });
  if (own && onlyReplaces && !businessBlock_(row)) {
    approveRow_('businesses', row, AUTO_BY);
    return;
  }
  alertContent_('businesses', row);
}

/** An active Rotarian in the members list. */
function businessMemberActive_(m) {
  return !!m && Core_isTrue(m.is_rotarian) && Core_str(m.status || 'active').toLowerCase() === 'active';
}

/** The member's approved listing this row updates: the same business name, or both speaker-only. */
function businessOlder_(rows, row) {
  var key = function (r) { return Core_str(r.business_name).toLowerCase().replace(/[^a-z0-9]/g, ''); };
  if (!Core_str(row.member_id)) return null;
  return rows.filter(function (r) {
    return r.id !== row.id && Core_str(r.status) === 'approved' && Core_str(r.member_id) === Core_str(row.member_id) && key(r) === key(row);
  })[0] || null;
}

/**
 * A message from the website's contact form: kept in the private Sheet and emailed on to the District office
 * moderators. Pressing Reply answers the person directly when they gave an email; a mobile number gets a
 * WhatsApp link. Messages that look like spam, and any beyond the daily limit, are kept but not emailed.
 */
function fileContact_(a, meta) {
  var ps = privateSs_();
  var s = settings_();
  var message = Core_str(a[Q.kMessage]);
  var spam = Core_contactCheck(message);
  var today = today_();
  var limit = Number(s.contact_daily_limit) || CORE_CONTACT_DAILY_LIMIT;
  var sentToday = readTab_(ps, 'contact_messages').filter(function (m) {
    return Core_str(m.forwarded_to) && Core_isoDate(new Date(m.submitted_at)) === today;
  }).length;
  var to = moderatorRecipients_('District office', 'contact_email');
  var row = {
    id: nextId_(readTab_(ps, 'contact_messages'), 'MSG-'), submitted_at: meta.submitted_at, name: Core_str(a[Q.kName]),
    reply_to: Core_str(a[Q.kReply]), topic: Core_str(a[Q.kTopic]), city: Core_str(a[Q.kCity]), message: message,
    status: spam ? 'spam' : 'new', forwarded_to: '', note: spam ? 'Not emailed: ' + spam : '',
  };
  if (!spam && sentToday >= limit) row.note = 'Not emailed: more than ' + limit + ' messages today';
  if (!spam && sentToday < limit) {
    try {
      contactAlert_(row, to);
      row.forwarded_to = to;
    } catch (e) {
      row.note = 'Email failed: ' + e.message;
    }
  }
  appendRow_(ps, 'contact_messages', row);
}

/** Tells the District office moderators about a contact message (also used by the practice round). */
function contactAlert_(row, to) {
  var email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.reply_to) ? row.reply_to : '';
  var mobile = Core_mobile(row.reply_to);
  MailApp.sendEmail(to, 'Website message: ' + row.topic + ' – from ' + row.name,
    'A message from the contact form on the district website.\n\nFrom: ' + row.name + '\nReply to: ' + row.reply_to +
    (row.city ? '\nCity: ' + row.city : '') + '\nAbout: ' + row.topic + '\n\n' + row.message + '\n\n' +
    (email ? 'Please answer from the moderation desk (Messages → Reply), not by pressing Reply here: the desk sends your answer from the ' +
        'district account, signed Rotary District 3110, so your own name and email stay private.'
      : mobile ? 'They gave a mobile number: +' + mobile + '. Please call or WhatsApp from the district office phone, not your personal phone.'
      : 'They gave no email or mobile number we can use.') +
    ' All messages are kept in the contact_messages tab of the private Sheet' + (deskLink_({}) ? ' and on the moderation desk: ' + deskLink_({}) : '.'),
    { name: 'Rotary 3110 website' }); // never replyTo the sender: a reply would show the moderator's own email
}

function fileConsent_(a, meta) {
  var ps = privateSs_();
  var spouseRotarian = yes_(a[Q.cSpouseRotarian]);
  var req = {
    id: nextId_(readTab_(ps, 'consent_requests'), 'CON-'), submitted_at: meta.submitted_at, submitter_email: meta.submitter_email,
    filled_by: Core_str(a[Q.cFilledBy]), club_id: clubIdByName_(a[Q.cClub]), name: Core_str(a[Q.cName]),
    member_id: Core_str(a[Q.cMemberId]), mobile: Core_str(a[Q.cMobile]),
    directory_ok: yes_(a[Q.cDirectory]), profession: Core_str(a[Q.cProfession]), area: Core_str(a[Q.cArea]),
    description: Core_str(a[Q.cWhat]), website: link_(a[Q.cWebsite]), spotlight_ok: checked_(a[Q.cSpotlight]),
    contact_ok: yes_(a[Q.cContact]), photo_ok: yes_(a[Q.cPhoto]), photo_file: fileIds_(firstStartingWith_(a, 'My photo')),
    birthday_ok: yes_(a[Q.cBirthday]), birthday: dayMonthAnswer_(a[Q.cBirthdayDate]),
    anniversary_ok: yes_(a[Q.cAnniversary]), spouse_is_rotarian: spouseRotarian ? 'Yes' : (Core_str(a[Q.cSpouseRotarian]) ? 'No' : ''),
    spouse_name: Core_str(a[Q.cSpouseName]), spouse_club_id: spouseRotarian ? clubIdByName_(a[Q.cSpouseClub]) : '',
    spouse_member_id: Core_str(a[Q.cSpouseId]), spouse_agrees: checked_(a[Q.cSpouseAgrees]),
    anniversary: dayMonthAnswer_(a[Q.cAnniversaryDate]), couple_photo_file: fileIds_(firstStartingWith_(a, 'Couple photo')),
    couple_photo_spouse_agrees: checked_(a[Q.cCoupleAgree]), declaration: checked_(a[Q.cDeclaration]), status: 'pending',
  };
  var row = appendRow_(ps, 'consent_requests', req);
  var notice = noticeMember_(ps, req);
  if (headers_(ps, 'consent_requests').indexOf('member_notice') >= 0) updateRow_(ps, 'consent_requests', row, { member_notice: notice });
  // from the member's own email, with the declaration ticked and no removal since: applied at once (Release 2)
  var check = consentChecker_(ps)(req);
  if (check.who === 'member' && req.declaration && !check.removal) {
    AFTER_FILING.push(function () {
      try {
        approveConsent_(req.id, AUTO_BY, false);
      } catch (e) {
        updateRow_(ps, 'consent_requests', row, { moderator_note: 'Not applied by itself: ' + e.message });
        alertMembers_('consent', req);
      }
    });
    return;
  }
  alertMembers_('consent', req);
}

/**
 * When a consent form did not come from the member's own email, the member hears about it at the email on file,
 * with time to object before anything is shown (safeguard, 1 Nov 2026). Returns what happened, for the moderator.
 */
function noticeMember_(ps, req) {
  var check = consentChecker_(ps)(req);
  if (check.who === 'member') return "Not needed: sent from the member's own email";
  var to = (check.memberEmails || []).join(',');
  if (!to) return 'Not told: no email on file';
  if (!deskQuota_(1)) return 'Not told: the daily email limit was reached';
  var choices = req.form ? detailsLines_(req).map(function (l) { return '- ' + l; }) : [
    [req.directory_ok, 'a listing in the members directory'], [req.contact_ok, 'a WhatsApp button'], [req.photo_ok, 'your photo'],
    [req.birthday_ok, 'birthday greetings'], [req.anniversary_ok, 'anniversary greetings'],
  ].filter(function (c) { return c[0]; }).map(function (c) { return '- ' + c[1]; });
  var until = Core_dateLabel(Core_isoDate(new Date(consentHoldUntil_(req, check))));
  var asks = req.form === 'update' ? 'A request to change your details for the district website' : 'A request to show your details on the district website';
  try {
    MailApp.sendEmail(to, 'Your details were sent to the Rotary District 3110 website',
      'Dear ' + (check.memberName || req.name) + ',\n\n' + asks + ' was sent for you by ' + req.submitter_email +
      (req.filled_by ? ' (as "' + req.filled_by + '")' : '') + '.\n\nIt asks:\n' + (choices.join('\n') || '- nothing') +
      '\n\nIf you or your club sent it, there is nothing to do. A district moderator checks every form, and nothing is shown before ' + until + '.' +
      '\n\nIf you did not agree to this, reply to this email, and nothing will be changed.' + removalLine_() +
      '\n\nRotary District 3110', { name: 'Rotary District 3110' });
    return 'Told by email ' + today_();
  } catch (e) {
    Logger.log('Notice to the member failed: ' + e.message);
    return 'Not told: the email failed';
  }
}

/**
 * A club change (17 Nov 2026): kept in the private Sheet as pending; nothing changes until a Members moderator approves.
 * The sender check (Release 3) applies as to the club's other updates; the moderator sees what the members list holds for the ID.
 */
function fileClubChange_(a, meta) {
  var ps = privateSs_();
  var said = Core_str(a[Q.gChange]);
  var change = Object.keys(CLUB_CHANGES).filter(function (k) { return CLUB_CHANGES[k] === said; })[0] || '';
  var date = { joined: Q.gJoined, left: Q.gLeft, moved: Q.gMoved, deceased: Q.gDied }[change];
  var newClub = Core_str(a[Q.gNewClub]);
  var req = {
    id: nextId_(readTab_(ps, 'club_change_requests'), 'CHG-'), submitted_at: meta.submitted_at, submitter_email: meta.submitter_email,
    club_id: clubIdByName_(a[Q.cClub]), change: change, member_id: Core_str(a[Q.gMemberId]).replace(/\D/g, ''), name: Core_str(a[Q.rName]),
    date: date ? Core_str(a[date]) : '', new_club_id: change !== 'moved' ? '' : newClub === CLUB_OUTSIDE ? 'outside' : clubIdByName_(newClub),
    rotary_year: Core_str(a[change === 'club_role' ? Q.gClubYear : Q.gDistYear]), role: Core_str(a[change === 'club_role' ? Q.gClubRole : Q.gRole]),
    section: change === 'district_role' ? Core_str(a[Q.gTeam]) : '', committee: change === 'district_role' ? Core_str(a[Q.gCommittee]) : '',
    note: Core_str(a[Q.gNote]), status: 'pending',
    mobile: change === 'joined' ? Core_str(a[Q.gMobile]) : '', email: change === 'joined' ? Core_str(a[Q.gEmail]).trim().toLowerCase() : '',
  };
  if (change !== 'club_role' && change !== 'district_role') { req.rotary_year = ''; req.role = ''; }
  var notes = [];
  if (req.mobile && !Core_mobile(req.mobile)) notes.push('The new member\'s mobile is not a 10-digit mobile: it will not be saved');
  if (!change) notes.push('The kind of change was not recognised: ' + said);
  if (!req.club_id) notes.push('Club not recognised: ' + Core_str(a[Q.cClub]));
  if (change === 'moved' && newClub === CLUB_OUTSIDE) notes.push('Moved to a club outside District 3110: approving marks the member as left');
  else if (change === 'moved' && !req.new_club_id) notes.push('New club not recognised: ' + newClub);
  notes = notes.concat(clubChangeNotes_(req, readTab_(ps, 'members_master')));
  textNotes_([req.note], notes);
  req.moderator_note = notes.join('; ');
  fileGated_(ps, 'club_change_requests', req, req.club_id, function () { alertMembers_('change', req); });
}

function fileRemoval_(a, meta) {
  var ps = privateSs_();
  var req = {
    id: nextId_(readTab_(ps, 'removal_requests'), 'REM-'), submitted_at: meta.submitted_at, submitter_email: meta.submitter_email,
    club_id: clubIdByName_(a[Q.rClub]), name: Core_str(a[Q.rName]), member_id: Core_str(a[Q.rMemberId]),
    mobile: Core_str(a[Q.rMobile]), remove_items: (a[Q.rItems] || []).join(', '), reason: Core_str(a[Q.rReason]), status: 'pending',
    filled_by: Core_str(a[Q.cFilledBy]),
  };
  appendRow_(ps, 'removal_requests', req);
  // the member's own request from their own email is done at once (Release 2)
  var master = readTab_(ps, 'members_master');
  var i = Core_matchMember(req, master);
  if (i >= 0 && Core_str(master[i].email) && Core_str(master[i].email).toLowerCase() === Core_str(meta.submitter_email).toLowerCase()) {
    AFTER_FILING.push(function () {
      try {
        approveRemoval_(req.id, AUTO_BY);
      } catch (e) {
        Logger.log('Removal ' + req.id + ' not done by itself: ' + e.message);
        alertMembers_('removal', req);
      }
    });
    return;
  }
  alertMembers_('removal', req);
}
