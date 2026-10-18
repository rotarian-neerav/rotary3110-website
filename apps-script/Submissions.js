/**
 * Form submissions: each answer is copied from the untouched raw tab into a working tab with
 * status "pending". Nothing goes live until a moderator approves it.
 */

function onAnyFormSubmit(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ids = JSON.parse(props_().getProperty('FORM_IDS') || '{}');
    var formId = e.source.getId();
    var answers = answersOf_(e.response);
    var meta = {
      submitted_at: e.response.getTimestamp().toISOString(),
      submitter_email: e.response.getRespondentEmail() || '',
    };
    if (formId === ids.activity) fileActivityOrEvent_(answers, meta);
    else if (formId === ids.club_profile) fileClubProfile_(answers, meta);
    else if (formId === ids.consent) fileConsent_(answers, meta);
    else if (formId === ids.removal) fileRemoval_(answers, meta);
    else if (formId === ids.public_service) filePublicService_(answers, meta);
    else if (formId === ids.contact) fileContact_(answers, meta);
  } finally {
    lock.releaseLock();
  }
}

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
    appendRow_(ss, 'events', ev);
    alertContent_('events', ev);
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
  if (Core_looksLikeUrl(row.press_paper)) {
    // a web address typed as the newspaper's name: keep it as the link, and ask for the name
    if (!row.press_link) row.press_link = link_(row.press_paper);
    row.press_paper = '';
    notes.push('The newspaper name was a web address: it is now the newspaper link; please add the newspaper\'s name');
  } else if (row.press_link && !row.press_paper) notes.push('Press link without the newspaper\'s name: add it in press_paper');
  if (row.video_link && !Core_videoLink(row.video_link)) notes.push('Video link is not a web address');
  textNotes_([row.press_paper], notes);
  row.moderator_note = notes.join('; ');
  appendRow_(ss, 'activities', row);
  alertContent_('activities', row);
}

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
  appendRow_(ss, 'club_profile_requests', req);
  alertContent_('club_profile_requests', req);
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
  appendRow_(ss, 'public_services', service);
  alertContent_('public_services', service);
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
      var email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.reply_to) ? row.reply_to : '';
      var mobile = Core_mobile(row.reply_to);
      MailApp.sendEmail(to, 'Website message: ' + row.topic + ' – from ' + row.name,
        'A message from the contact form on the district website.\n\nFrom: ' + row.name + '\nReply to: ' + row.reply_to +
        (row.city ? '\nCity: ' + row.city : '') + '\nAbout: ' + row.topic + '\n\n' + message + '\n\n' +
        (email ? 'Please answer from the moderation desk (Messages → Reply), not by pressing Reply here: the desk sends your answer from the ' +
            'district account, signed Rotary District 3110, so your own name and email stay private.'
          : mobile ? 'They gave a mobile number: +' + mobile + '. Please call or WhatsApp from the district office phone, not your personal phone.'
          : 'They gave no email or mobile number we can use.') +
        ' All messages are kept in the contact_messages tab of the private Sheet' + (deskLink_({}) ? ' and on the moderation desk: ' + deskLink_({}) : '.'),
        { name: 'Rotary 3110 website' }); // never replyTo the sender: a reply would show the moderator's own email
      row.forwarded_to = to;
    } catch (e) {
      row.note = 'Email failed: ' + e.message;
    }
  }
  appendRow_(ps, 'contact_messages', row);
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
  appendRow_(ps, 'consent_requests', req);
  alertMembers_('consent', req);
}

function fileRemoval_(a, meta) {
  var ps = privateSs_();
  var req = {
    id: nextId_(readTab_(ps, 'removal_requests'), 'REM-'), submitted_at: meta.submitted_at, submitter_email: meta.submitter_email,
    club_id: clubIdByName_(a[Q.rClub]), name: Core_str(a[Q.rName]), member_id: Core_str(a[Q.rMemberId]),
    mobile: Core_str(a[Q.rMobile]), remove_items: (a[Q.rItems] || []).join(', '), reason: Core_str(a[Q.rReason]), status: 'pending',
  };
  appendRow_(ps, 'removal_requests', req);
  alertMembers_('removal', req);
}
