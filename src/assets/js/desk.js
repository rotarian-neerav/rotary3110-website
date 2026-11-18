// The moderation desk. Talks only to the district's Sheet script (its address arrives after the # in the links
// emailed to moderators, and is remembered on this phone). Nothing here is shown until the script answers.
(function () {
  var root = document.querySelector('[data-desk]');
  if (!root) return;
  // Never inside another site's frame, where a hidden page could trick a moderator into tapping Approve.
  // (GitHub Pages cannot send the header that forbids framing; once the site is behind Cloudflare it can.)
  if (window.top !== window.self) {
    root.innerHTML = '<p>Open the moderation desk directly: <a href="' + location.pathname + '" target="_top">' + location.host + location.pathname + '</a></p>';
    return;
  }
  var out = root.querySelector('[data-out]');
  var msgBox = root.querySelector('[data-msg]');
  var meBox = root.querySelector('[data-me]');
  var signOutBtn = root.querySelector('[data-signout]');
  var langBtn = root.querySelector('[data-lang]');

  var T = {
    en: {
      // Release 1 (18 Nov 2026)
      tabRoles: 'Roles', tabAdmin: 'Admin', subClean: 'Clean', subLook: 'Needs a look', otherZones: 'Other areas',
      cleanIntro: 'Nothing to check was found in these. Glance at each, untick any that look wrong (it moves to Needs a look), then approve the rest.',
      approveTicked: 'Approve the ticked ({n})', confirmMany: 'Approve {n} activities?', showMore: 'Show more', lookIntro: 'Each of these needs a full look: the reason is at the top.',
      hide: 'Hide', putBackSite: 'Put back', hidden: 'Hidden from the website', hideReason: 'Why it comes off the website (kept in the log; the club is not emailed)',
      reasonLog: 'Reason (kept in the change log)', findMember: 'Find a member', findHint: 'Name (3 letters or more), RI member ID, email or mobile',
      edit: 'Edit', status: 'Status', active: 'active', left: 'left', deceasedS: 'deceased', club: 'Club', recentChanges: 'Recent changes', undo: 'Undo', undone: 'Undone',
      confirmClub: 'I have confirmed this with the club', roleChecks: 'Roles to check', open: 'Open', findRole: 'Find a role', roleHint: 'Name, club or RI member ID',
      ended: 'Ended', change: 'Change', endRole: 'End role', endReason: 'Why the role ends (resigned, replaced…)', addOfficer: 'Add an office bearer',
      year: 'Rotary year', role: 'Role', memberId: 'RI member ID', agClubs: "Assistant Governor's clubs (names, separated by commas)", zone: 'Area',
      clubsAdmin: 'Clubs', addClub: 'Add a club', clubId: 'RI club ID', clubName: 'Club name (e.g. RC Agra Heritage)', city: 'City', charter: 'Charter date',
      closeClub: 'Close', moveTo: 'Its members', markLeft: 'Mark them as left', moveInto: 'Move them to ', filterClubs: 'Filter clubs', members: 'members', closed: 'closed',
      moderatorsAdmin: 'Moderators', addModerator: 'Add a moderator', type: 'Type', name2: 'Name', email2: 'Google email', isActive: 'Active', yes: 'Yes', no: 'No', allZones: 'all areas',
      mobile: 'Mobile', emailF: 'Email', confirmClose: 'Close {name}? Its members move or are marked as left.',
      title: 'Moderation desk', guide: 'Guide', signOut: 'Sign out', other: 'हिन्दी', loading: 'Loading…', working: 'Working…',
      noApi: 'Open the desk from the link in any moderator email. After that, this phone remembers it.',
      signInIntro: 'Type the email address that is on the moderators list. We will email you a 6-digit code.',
      email: 'Your email', sendCode: 'Send me a code', code: 'The 6-digit code from the email', signIn: 'Sign in', otherEmail: 'Use a different email',
      signInAs: 'Sign in as', signedInAs: 'Signed in as',
      tabCheck: 'To check', tabRecent: 'Recent', tabMembers: 'Members', tabClubs: 'Quiet clubs', tabOffice: 'Messages',
      nothing: 'Nothing waiting. Thank you!', approve: 'Approve', reject: 'Reject', correct: 'Correct', save: 'Save', cancel: 'Cancel',
      confirmApprove: 'Yes, approve', confirmReject: 'Reject with this reason', reason: 'Reason (sent to the person who sent it)',
      reasons: ['The photos have no consent tick', 'This is not a Rotary service activity', 'Already posted (a duplicate)', 'Please send a clearer photo', 'Please remove the phone number or email'],
      check: 'Please check', cannot: 'Cannot be approved yet', sentBy: 'Sent by', call: 'Call', tapPhoto: 'Tap a photo to see it larger',
      story: '★ Story of the month', leaveOut: 'Leave out of bulletin', leaveThisOut: 'Leave this out', putBack: 'Put it back in',
      leftOut: 'Left out of the bulletin', inBulletin: 'In the bulletin',
      recentActs: 'Approved activities, last 30 days', upcoming: 'Coming events', none: 'None.',
      consent: 'Consent forms', removal: 'Removal requests', removeNow: 'Remove now', couples: 'Couples waiting', changes: 'Club changes',
      sentFrom: 'Sent from', memberTold: 'Member', holdUntil: 'The member can object until {day}. Approve after that, or confirm with them now.',
      confirmed: 'I have confirmed this with the member (or their club President or Secretary)',
      datesDiffer: 'Dates differ: check with the couple', waitingSpouse: "Waiting for the spouse's own form",
      deceased: 'Mark as deceased', searchName: 'Type at least three letters of the name', search: 'Search',
      confirmDeceased: 'Mark {name} as deceased? Birthday and anniversary greetings stop at once.', noOne: 'No one found.',
      quietIntro: 'Active clubs with no activity in the last 30 days.', lastActivity: 'Last activity', never: 'none yet',
      reminded: 'Reminded', by: 'by', emailClub: 'Email President and Secretary', whatsapp: 'WhatsApp',
      reply: 'Reply', replyLabel: 'Your answer (sent from the district account, signed Rotary District 3110; your name and email are not shown)', send: 'Send', phoneOnly: 'Mobile number: please call or WhatsApp from the district office phone, not your personal phone.', earlier: 'Sent earlier', markAnswered: 'Mark answered', answered: 'Answered', newMsg: 'New',
      openDesk: 'Open the moderation desk', linkFor: 'This link is for', approveQ: 'Approve this?', rejectQ: 'Reject this?',
      leaveQ: "Leave this out of Sunday's bulletin?", fields: { title: 'Title', description: 'Description', press_paper: 'Newspaper name',
        venue: 'Venue', fee: 'Fee', meeting_day_place: 'Meeting day and place', permanent_projects: 'Permanent projects',
        regular_services: 'Regular services', name: 'Name', timings: 'Timings', phone: 'Phone (shown on the website)', address: 'Address', about: 'About' },
    },
    hi: {
      tabRoles: 'पद', tabAdmin: 'प्रशासन', subClean: 'साफ़', subLook: 'देखना ज़रूरी', otherZones: 'दूसरे क्षेत्र',
      cleanIntro: 'इनमें जाँचने लायक कुछ नहीं मिला। हर एक पर नज़र डालें, जो ठीक न लगे उसका टिक हटाएँ (वह "देखना ज़रूरी" में चला जाएगा), फिर बाकी स्वीकृत करें।',
      approveTicked: 'टिक किए गए स्वीकृत करें ({n})', confirmMany: '{n} गतिविधियाँ स्वीकृत करें?', showMore: 'और दिखाएँ', lookIntro: 'इनमें से हर एक को पूरा देखना है: कारण सबसे ऊपर लिखा है।',
      hide: 'छिपाएँ', putBackSite: 'वापस लगाएँ', hidden: 'वेबसाइट से छिपाया गया', hideReason: 'यह वेबसाइट से क्यों हट रहा है (लॉग में रहेगा; क्लब को ईमेल नहीं जाएगा)',
      reasonLog: 'कारण (बदलाव लॉग में रहेगा)', findMember: 'सदस्य खोजें', findHint: 'नाम (कम से कम 3 अक्षर), RI सदस्य ID, ईमेल या मोबाइल',
      edit: 'बदलें', status: 'स्थिति', active: 'सक्रिय', left: 'छोड़ गए', deceasedS: 'दिवंगत', club: 'क्लब', recentChanges: 'हाल के बदलाव', undo: 'वापस लें', undone: 'वापस लिया गया',
      confirmClub: 'मैंने क्लब से इसकी पुष्टि कर ली है', roleChecks: 'जाँचने वाले पद', open: 'खोलें', findRole: 'पद खोजें', roleHint: 'नाम, क्लब या RI सदस्य ID',
      ended: 'समाप्त', change: 'बदलें', endRole: 'पद समाप्त करें', endReason: 'पद क्यों समाप्त हो रहा है (इस्तीफ़ा, बदलाव…)', addOfficer: 'पदाधिकारी जोड़ें',
      year: 'रोटरी वर्ष', role: 'पद', memberId: 'RI सदस्य ID', agClubs: 'असिस्टेंट गवर्नर के क्लब (नाम, अल्पविराम से अलग)', zone: 'क्षेत्र',
      clubsAdmin: 'क्लब', addClub: 'क्लब जोड़ें', clubId: 'RI क्लब ID', clubName: 'क्लब का नाम (जैसे RC Agra Heritage)', city: 'शहर', charter: 'चार्टर की तारीख',
      closeClub: 'बंद करें', moveTo: 'इसके सदस्य', markLeft: 'उन्हें "छोड़ गए" चिह्नित करें', moveInto: 'उन्हें यहाँ ले जाएँ: ', filterClubs: 'क्लब छाँटें', members: 'सदस्य', closed: 'बंद',
      moderatorsAdmin: 'मॉडरेटर', addModerator: 'मॉडरेटर जोड़ें', type: 'प्रकार', name2: 'नाम', email2: 'Google ईमेल', isActive: 'सक्रिय', yes: 'हाँ', no: 'नहीं', allZones: 'सभी क्षेत्र',
      mobile: 'मोबाइल', emailF: 'ईमेल', confirmClose: '{name} बंद करें? इसके सदस्य दूसरे क्लब में जाएँगे या "छोड़ गए" चिह्नित होंगे।',
      title: 'मॉडरेशन डेस्क', guide: 'गाइड', signOut: 'साइन आउट', other: 'English', loading: 'लोड हो रहा है…', working: 'काम हो रहा है…',
      noApi: 'किसी भी मॉडरेटर ईमेल में दिए गए लिंक से डेस्क खोलें। उसके बाद यह फ़ोन इसे याद रखेगा।',
      signInIntro: 'मॉडरेटर सूची में दर्ज अपना ईमेल पता लिखें। हम आपको 6 अंकों का कोड ईमेल करेंगे।',
      email: 'आपका ईमेल', sendCode: 'मुझे कोड भेजें', code: 'ईमेल में आया 6 अंकों का कोड', signIn: 'साइन इन करें', otherEmail: 'दूसरा ईमेल इस्तेमाल करें',
      signInAs: 'इस ईमेल से साइन इन करें:', signedInAs: 'साइन इन:',
      tabCheck: 'जाँचने के लिए', tabRecent: 'हाल के', tabMembers: 'सदस्य', tabClubs: 'शांत क्लब', tabOffice: 'संदेश',
      nothing: 'कुछ भी बाकी नहीं। धन्यवाद!', approve: 'स्वीकृत करें', reject: 'अस्वीकार करें', correct: 'सुधारें', save: 'सहेजें', cancel: 'रद्द करें',
      confirmApprove: 'हाँ, स्वीकृत करें', confirmReject: 'इस कारण से अस्वीकार करें', reason: 'कारण (भेजने वाले को भेजा जाएगा)',
      reasons: ['फ़ोटो के लिए सहमति का टिक नहीं है', 'यह रोटरी सेवा गतिविधि नहीं है', 'यह पहले ही भेजा जा चुका है', 'कृपया साफ़ फ़ोटो भेजें', 'कृपया फ़ोन नंबर या ईमेल हटाएँ'],
      check: 'कृपया जाँचें', cannot: 'अभी स्वीकृत नहीं हो सकता', sentBy: 'भेजने वाले', call: 'कॉल करें', tapPhoto: 'बड़ा देखने के लिए फ़ोटो पर टैप करें',
      story: '★ महीने की कहानी', leaveOut: 'बुलेटिन से हटाएँ', leaveThisOut: 'इसे हटा दें', putBack: 'वापस जोड़ें',
      leftOut: 'बुलेटिन से हटाया गया', inBulletin: 'बुलेटिन में है',
      recentActs: 'पिछले 30 दिनों की स्वीकृत गतिविधियाँ', upcoming: 'आने वाले कार्यक्रम', none: 'कोई नहीं।',
      consent: 'सहमति फ़ॉर्म', removal: 'हटाने के अनुरोध', removeNow: 'अभी हटाएँ', couples: 'प्रतीक्षा में दंपति', changes: 'क्लब में बदलाव',
      sentFrom: 'किस ईमेल से भेजा', memberTold: 'सदस्य', holdUntil: 'सदस्य {day} तक आपत्ति कर सकते हैं। उसके बाद स्वीकृत करें, या अभी उनसे पुष्टि करें।',
      confirmed: 'मैंने सदस्य (या उनके क्लब के अध्यक्ष या सचिव) से इसकी पुष्टि कर ली है',
      datesDiffer: 'तारीखें अलग हैं: दंपति से पूछें', waitingSpouse: 'जीवनसाथी के अपने फ़ॉर्म की प्रतीक्षा',
      deceased: 'दिवंगत चिह्नित करें', searchName: 'नाम के कम से कम तीन अक्षर लिखें', search: 'खोजें',
      confirmDeceased: '{name} को दिवंगत चिह्नित करें? जन्मदिन और वर्षगाँठ की शुभकामनाएँ तुरंत बंद हो जाएँगी।', noOne: 'कोई नहीं मिला।',
      quietIntro: 'सक्रिय क्लब जिनकी पिछले 30 दिनों में कोई गतिविधि नहीं आई।', lastActivity: 'आखिरी गतिविधि', never: 'अभी तक कोई नहीं',
      reminded: 'याद दिलाया', by: 'द्वारा', emailClub: 'अध्यक्ष और सचिव को ईमेल करें', whatsapp: 'व्हाट्सऐप',
      reply: 'जवाब दें', replyLabel: 'आपका जवाब (डिस्ट्रिक्ट खाते से, "Rotary District 3110" के नाम से जाएगा; आपका नाम और ईमेल नहीं दिखेगा)', send: 'भेजें', phoneOnly: 'मोबाइल नंबर: कृपया डिस्ट्रिक्ट ऑफ़िस के फ़ोन से कॉल या व्हाट्सऐप करें, अपने निजी फ़ोन से नहीं।', earlier: 'पहले भेजा गया', markAnswered: 'जवाब दिया गया', answered: 'जवाब दिया गया', newMsg: 'नया',
      openDesk: 'मॉडरेशन डेस्क खोलें', linkFor: 'यह लिंक इनके लिए है:', approveQ: 'इसे स्वीकृत करें?', rejectQ: 'इसे अस्वीकार करें?',
      leaveQ: 'इसे रविवार के बुलेटिन से हटाएँ?', fields: { title: 'शीर्षक', description: 'विवरण', press_paper: 'अख़बार का नाम',
        venue: 'स्थान', fee: 'शुल्क', meeting_day_place: 'बैठक का दिन और स्थान', permanent_projects: 'स्थायी परियोजनाएँ',
        regular_services: 'नियमित सेवाएँ', name: 'नाम', timings: 'समय', phone: 'फ़ोन (वेबसाइट पर दिखेगा)', address: 'पता', about: 'विवरण' },
    },
  };

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* private window */ } },
  };
  var lang = store.get('deskLang') === 'hi' ? 'hi' : 'en';
  function t(k) { return T[lang][k]; }

  // What arrived after the #: k = the script's id, a = an item link, do = approve/reject, s = a sign-in link
  var hash = {};
  location.hash.replace(/^#/, '').split('&').forEach(function (p) {
    var i = p.indexOf('=');
    if (i > 0) hash[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1));
  });
  if (location.hash) history.replaceState(null, '', location.pathname); // links are personal: keep them out of the history
  var apiId = null;
  var session = null;
  // The desk talks only to the district's Sheet script: the page carries a one-way fingerprint of its id (sent by the
  // script at each build), and a link naming another script is refused. Until the Sheet sends one, a new id at least
  // signs this phone out, so a session is never handed to another script.
  var apiFp = root.getAttribute('data-api-fp') || '';
  function sha256(s) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    });
  }
  function genuine(id) {
    if (!id || !/^[\w-]{20,}$/.test(id)) return Promise.resolve(false);
    if (!apiFp) return Promise.resolve(true);
    return sha256(id).then(function (h) { return h === apiFp; }, function () { return false; });
  }
  var ready = Promise.all([genuine(hash.k), genuine(store.get('deskApi'))]).then(function (ok) {
    if (hash.k && ok[0]) {
      if (store.get('deskApi') !== hash.k) store.set('deskSession', null);
      store.set('deskApi', hash.k);
    } else if (!ok[1]) {
      store.set('deskApi', null);
      store.set('deskSession', null);
    }
    apiId = store.get('deskApi');
    session = store.get('deskSession');
  });
  var state = { tab: store.get('deskTab') || 'check', data: null, me: null };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function safeUrl(u) { return /^(https?:|mailto:|tel:)/i.test(String(u || '')) ? u : '#'; }
  function say(text, bad) {
    msgBox.hidden = !text;
    msgBox.textContent = text || '';
    msgBox.className = 'desk-msg' + (bad ? ' desk-msg-bad' : '');
    if (text) msgBox.scrollIntoView({ block: 'nearest' });
  }
  function day(iso) {
    if (!iso) return '';
    var d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  function api(payload) {
    if (session && !payload.token && payload.fn !== 'code' && payload.fn !== 'signin') payload.session = session;
    return fetch('https://script.google.com/macros/s/' + apiId + '/exec', {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload),
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.ok) {
        if (d.signedOut) setSession(null);
        throw new Error(d.error || 'Something went wrong');
      }
      return d;
    });
  }
  function setSession(s, me) {
    session = s;
    store.set('deskSession', s);
    state.me = me || null;
    signOutBtn.hidden = !s;
    meBox.hidden = !(me && s);
    if (me && s) meBox.textContent = t('signedInAs') + ' ' + me.name + (me.name !== me.email ? ' (' + me.email + ')' : '') + ' · ' + me.types.join(', ');
  }

  function applyLang() {
    document.documentElement.lang = lang === 'hi' ? 'hi' : 'en';
    langBtn.textContent = t('other');
    Array.prototype.forEach.call(root.querySelectorAll('[data-t]'), function (el) { el.textContent = t(el.getAttribute('data-t')); });
  }
  langBtn.addEventListener('click', function () {
    lang = lang === 'en' ? 'hi' : 'en';
    store.set('deskLang', lang);
    applyLang();
    if (state.me) setSession(session, state.me);
    redraw();
  });
  signOutBtn.addEventListener('click', function () { setSession(null); say(''); showSignIn(); });

  var redraw = function () {};

  /* ---------- Signing in ---------- */

  function showSignIn(email) {
    redraw = function () { showSignIn(email); };
    out.innerHTML = '<form class="desk-form" data-email-form><p>' + esc(t('signInIntro')) + '</p>' +
      '<label>' + esc(t('email')) + '<input type="email" name="email" autocomplete="email" required value="' + esc(email || store.get('deskEmail') || '') + '"></label>' +
      '<button class="btn btn-go" type="submit">' + esc(t('sendCode')) + '</button></form>';
    out.querySelector('[data-email-form]').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var e = ev.target.email.value.trim();
      store.set('deskEmail', e);
      say(t('working'));
      api({ fn: 'code', email: e }).then(function (d) { say(d.message); showCode(e); }).catch(function (err) { say(err.message, true); });
    });
  }

  function showCode(email) {
    redraw = function () { showCode(email); };
    out.innerHTML = '<form class="desk-form" data-code-form><label>' + esc(t('code')) +
      '<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,7}" maxlength="7" required></label>' +
      '<button class="btn btn-go" type="submit">' + esc(t('signIn')) + '</button> ' +
      '<button class="btn-small" type="button" data-back>' + esc(t('otherEmail')) + '</button></form>';
    out.querySelector('[data-back]').addEventListener('click', function () { say(''); showSignIn(email); });
    out.querySelector('[data-code-form]').addEventListener('submit', function (ev) {
      ev.preventDefault();
      say(t('working'));
      api({ fn: 'signin', email: email, code: ev.target.code.value }).then(signedIn).catch(function (err) { say(err.message, true); });
    });
  }

  function showLinkSignIn(token) {
    var who = String(token).split('~')[3] || '';
    redraw = function () { showLinkSignIn(token); };
    out.innerHTML = '<div class="desk-form"><p>' + esc(t('signInAs')) + ' <strong>' + esc(who) + '</strong></p>' +
      '<button class="btn btn-go" type="button" data-go>' + esc(t('signIn')) + '</button></div>';
    out.querySelector('[data-go]').addEventListener('click', function () {
      say(t('working'));
      api({ fn: 'signin', token: token }).then(signedIn).catch(function (err) { say(err.message, true); showSignIn(); });
    });
  }

  function signedIn(d) {
    setSession(d.session, d.me);
    say('');
    load();
  }

  /* ---------- Cards ---------- */

  function photosHtml(refs, token) {
    if (!refs || !refs.length) return '';
    return '<div class="desk-photos" data-photos>' + refs.map(function (r) {
      return '<button type="button" class="desk-photo" data-ref="' + esc(r) + '"' + (token ? ' data-token="' + esc(token) + '"' : '') + ' aria-label="Photo"></button>';
    }).join('') + '</div><p class="small muted">' + esc(t('tapPhoto')) + '</p>';
  }

  // only a picture type and base64 characters go into the page
  function imgHtml(d) {
    if (!/^image\/[\w.+-]+$/.test(d.mimeType || '') || !/^[A-Za-z0-9+/=]+$/.test(d.base64 || '')) return '';
    return '<img alt="" src="data:' + d.mimeType + ';base64,' + d.base64 + '">';
  }

  function loadPhotos(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll('.desk-photo[data-ref]:not([data-loaded])'), function (b) {
      b.setAttribute('data-loaded', '1');
      var req = { fn: 'photo', ref: b.getAttribute('data-ref') };
      if (b.getAttribute('data-token')) req.token = b.getAttribute('data-token');
      api(req).then(function (d) {
        var img = imgHtml(d);
        if (img) b.innerHTML = img;
      }).catch(function () { b.textContent = '–'; });
      b.addEventListener('click', function () {
        if (b.getAttribute('data-full')) return;
        b.setAttribute('data-full', '1');
        req.full = true;
        api(req).then(function (d) {
          var img = imgHtml(d);
          if (!img) return;
          b.classList.add('desk-photo-full');
          b.innerHTML = img;
        }).catch(function () { /* the small picture stays */ });
      });
    });
  }

  function itemHtml(c, token) {
    var h = '<article class="desk-card" data-item="' + esc(c.tab) + '|' + esc(c.id) + '">' +
      '<p class="desk-kind">' + esc(c.kind) + ' · ' + esc(c.id) + '</p><h2>' + esc(c.title) + '</h2>' +
      '<p class="muted">' + esc([c.club, day(c.date)].filter(Boolean).join(' · ')) + '</p>';
    if (c.block) h += '<p class="desk-bad">' + esc(t('cannot')) + ': ' + esc(c.block) + '</p>';
    var checks = c.checks || c.notes || [];
    if (checks.length) h += '<p class="desk-note"><strong>' + esc(t('check')) + ':</strong> ' + esc(checks.join('; ')) + '</p>';
    if (c.text) h += '<p class="desk-text">' + esc(c.text) + '</p>';
    h += photosHtml(c.photos, token);
    if (c.lines.length || c.links.length) {
      h += '<dl class="desk-lines">' + c.lines.map(function (l) { return '<dt>' + esc(l[0]) + '</dt><dd>' + esc(l[1]) + '</dd>'; }).join('') +
        c.links.map(function (l) { return '<dt>' + esc(l[0]) + '</dt><dd><a href="' + esc(safeUrl(l[1])) + '" target="_blank" rel="noopener noreferrer">' + esc(l[1]) + '</a></dd>'; }).join('') + '</dl>';
    }
    if (c.sender) {
      h += '<p class="small muted">' + esc(t('sentBy')) + ' ' + esc(c.sender) + ' · ' + esc(day(c.submitted)) +
        (c.sender_mobile ? ' · <a href="tel:+' + esc(c.sender_mobile) + '">' + esc(t('call')) + '</a> · <a href="https://wa.me/' + esc(c.sender_mobile) + '" target="_blank" rel="noopener">' + esc(t('whatsapp')) + '</a>' : '') + '</p>';
    }
    if (c.status === 'pending') {
      h += '<div class="desk-actions" data-actions>' +
        (c.block ? '' : '<button type="button" class="btn btn-go" data-do="approve">' + esc(t('approve')) + '</button>') +
        '<button type="button" class="btn btn-no" data-do="reject">' + esc(t('reject')) + '</button>' +
        (token ? '' : '<button type="button" class="btn-small" data-do="edit">' + esc(t('correct')) + '</button>') + '</div><div data-panel></div>';
    }
    return h + '</article>';
  }

  function rejectPanel(panel, done) {
    panel.innerHTML = '<form class="desk-form" data-reject><label>' + esc(t('reason')) + '<textarea name="reason" rows="3" required maxlength="500"></textarea></label>' +
      '<p class="desk-chips">' + t('reasons').map(function (r) { return '<button type="button" class="chip-btn">' + esc(r) + '</button>'; }).join('') + '</p>' +
      '<button class="btn btn-no" type="submit">' + esc(t('confirmReject')) + '</button> <button class="btn-small" type="button" data-cancel>' + esc(t('cancel')) + '</button></form>';
    var form = panel.querySelector('form');
    Array.prototype.forEach.call(panel.querySelectorAll('.chip-btn'), function (b) {
      b.addEventListener('click', function () { form.reason.value = b.textContent; form.reason.focus(); });
    });
    panel.querySelector('[data-cancel]').addEventListener('click', function () { panel.innerHTML = ''; });
    form.addEventListener('submit', function (ev) { ev.preventDefault(); done(form.reason.value.trim()); });
    form.reason.focus();
  }

  function editPanel(panel, c) {
    var keys = Object.keys(c.edit || {});
    panel.innerHTML = '<form class="desk-form" data-edit>' + keys.map(function (k) {
      var long = /description|about|projects|services/.test(k);
      var label = (t('fields') || {})[k] || k;
      return '<label>' + esc(label) + (long ? '<textarea name="' + esc(k) + '" rows="5">' + esc(c.edit[k]) + '</textarea>'
        : '<input name="' + esc(k) + '" value="' + esc(c.edit[k]) + '">') + '</label>';
    }).join('') + '<button class="btn btn-go" type="submit">' + esc(t('save')) + '</button> <button class="btn-small" type="button" data-cancel>' + esc(t('cancel')) + '</button></form>';
    var form = panel.querySelector('form');
    panel.querySelector('[data-cancel]').addEventListener('click', function () { panel.innerHTML = ''; });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var fields = {};
      keys.forEach(function (k) { fields[k] = form[k].value; });
      say(t('working'));
      api({ fn: 'edit', tab: c.tab, id: c.id, fields: fields }).then(function (d) { say(d.message); replaceCard(c, d.item); }).catch(function (err) { say(err.message, true); });
    });
  }

  function replaceCard(old, item) {
    var el = out.querySelector('[data-item="' + old.tab + '|' + old.id + '"]');
    if (!el) return;
    var box = document.createElement('div');
    box.innerHTML = itemHtml(item);
    el.parentNode.replaceChild(box.firstChild, el);
    wireCards([item]);
  }

  function wireCards(cards) {
    cards.forEach(function (c) {
      var el = out.querySelector('[data-item="' + c.tab + '|' + c.id + '"]');
      if (!el) return;
      loadPhotos(el);
      var panel = el.querySelector('[data-panel]');
      Array.prototype.forEach.call(el.querySelectorAll('[data-do]'), function (b) {
        b.addEventListener('click', function () {
          var what = b.getAttribute('data-do');
          var finish = function (d) {
        say(d.message); el.classList.add('desk-done'); el.querySelector('[data-actions]').remove(); panel.innerHTML = '';
        var tick = el.querySelector('.desk-confirm'); if (tick) tick.remove();
      };
          if (what === 'approve') {
            say(t('working'));
            api({ fn: 'approve', tab: c.tab, id: c.id }).then(finish).catch(function (err) { say(err.message, true); });
          } else if (what === 'reject') {
            rejectPanel(panel, function (reason) {
              say(t('working'));
              api({ fn: 'reject', tab: c.tab, id: c.id, reason: reason }).then(finish).catch(function (err) { say(err.message, true); });
            });
          } else editPanel(panel, c);
        });
      });
    });
  }

  /* ---------- A link from an email: one item, one more tap ---------- */

  function showLink(token, intent) {
    redraw = function () { showLink(token, intent); };
    out.innerHTML = '<p class="muted">' + esc(t('loading')) + '</p>';
    api({ fn: 'peek', token: token }).then(function (d) {
      var c = d.item;
      var h = '<p class="small muted">' + esc(t('linkFor')) + ' ' + esc(d.me.name) + '</p>';
      if (d.kind === 'bx') {
        h += '<article class="desk-card"><p class="desk-kind">' + esc(c.kind) + '</p><h2>' + esc(c.title) + '</h2><p class="muted">' + esc([c.club, day(c.date)].filter(Boolean).join(' · ')) + '</p>' +
          '<p><strong>' + esc(d.left_out ? t('leftOut') : t('leaveQ')) + '</strong></p><div class="desk-actions">' +
          (d.left_out ? '<button type="button" class="btn-small" data-bx="putback">' + esc(t('putBack')) + '</button>'
            : '<button type="button" class="btn btn-no" data-bx="leaveout">' + esc(t('leaveThisOut')) + '</button>') + '</div></article>';
      } else {
        c.status = d.message ? 'done' : c.status;
        h += itemHtml(c, token);
        if (d.message) h += '<p class="desk-note">' + esc(d.message) + '</p>';
      }
      h += '<p><a class="btn-small" href="" data-open>' + esc(t('openDesk')) + '</a></p>';
      out.innerHTML = h;
      out.querySelector('[data-open]').addEventListener('click', function (ev) { ev.preventDefault(); say(''); start(); });
      loadPhotos(out);
      Array.prototype.forEach.call(out.querySelectorAll('[data-bx]'), function (b) {
        b.addEventListener('click', function () {
          say(t('working'));
          api({ fn: 'confirm', token: token, action: b.getAttribute('data-bx') }).then(function (r) { say(r.message); b.remove(); }).catch(function (err) { say(err.message, true); });
        });
      });
      var el = out.querySelector('[data-actions]');
      var panel = out.querySelector('[data-panel]');
      if (!el || !panel || d.kind === 'bx') return;
      var finish = function (r) { say(r.message); el.remove(); panel.innerHTML = ''; };
      var ask = function (what) {
        if (what === 'approve') {
          panel.innerHTML = '<div class="desk-form"><p><strong>' + esc(t('approveQ')) + '</strong></p><button type="button" class="btn btn-go" data-yes>' + esc(t('confirmApprove')) + '</button> ' +
            '<button type="button" class="btn-small" data-cancel>' + esc(t('cancel')) + '</button></div>';
          panel.querySelector('[data-cancel]').addEventListener('click', function () { panel.innerHTML = ''; });
          panel.querySelector('[data-yes]').addEventListener('click', function () {
            say(t('working'));
            api({ fn: 'confirm', token: token, action: 'approve' }).then(finish).catch(function (err) { say(err.message, true); });
          });
        } else {
          rejectPanel(panel, function (reason) {
            say(t('working'));
            api({ fn: 'confirm', token: token, action: 'reject', reason: reason }).then(finish).catch(function (err) { say(err.message, true); });
          });
        }
      };
      Array.prototype.forEach.call(el.querySelectorAll('[data-do]'), function (b) {
        b.addEventListener('click', function () { ask(b.getAttribute('data-do')); });
      });
      if (intent === 'approve' && !c.block) ask('approve');
      if (intent === 'reject') ask('reject');
    }).catch(function (err) {
      out.innerHTML = '<p><a class="btn-small" href="" data-open>' + esc(t('openDesk')) + '</a></p>';
      out.querySelector('[data-open]').addEventListener('click', function (ev) { ev.preventDefault(); say(''); start(); });
      say(err.message, true);
    });
  }

  /* ---------- The desk ---------- */

  function load() {
    out.innerHTML = '<p class="muted">' + esc(t('loading')) + '</p>';
    api({ fn: 'list' }).then(function (d) {
      state.data = d;
      setSession(session, d.me);
      drawDesk();
    }).catch(function (err) {
      say(err.message, true);
      if (!session) showSignIn();
    });
  }

  function tabs() {
    var d = state.data;
    var list = [];
    if (d.content) list.push(['check', t('tabCheck'), d.content.pending.length], ['recent', t('tabRecent'), null]);
    if (d.members) list.push(['members', t('tabMembers'), d.members.consent.length + d.members.removal.length + (d.members.change || []).length]);
    if (d.roles) list.push(['roles', t('tabRoles'), (d.roles.checks || []).length]);
    if (d.clubs) list.push(['clubs', t('tabClubs'), d.clubs.length]);
    if (d.office) list.push(['office', t('tabOffice'), d.office.filter(function (m) { return m.status === 'new'; }).length]);
    if (d.admin) list.push(['admin', t('tabAdmin'), null]);
    return list;
  }

  function drawDesk() {
    redraw = drawDesk;
    var list = tabs();
    if (!list.some(function (x) { return x[0] === state.tab; })) state.tab = list.length ? list[0][0] : '';
    var h = '<nav class="desk-tabs" aria-label="Desk">' + list.map(function (x) {
      return '<button type="button" data-tab="' + x[0] + '"' + (x[0] === state.tab ? ' aria-current="true"' : '') + '>' + esc(x[1]) +
        (x[2] ? ' <span class="desk-count">' + x[2] + '</span>' : '') + '</button>';
    }).join('') + '</nav><div data-view></div>';
    out.innerHTML = h;
    Array.prototype.forEach.call(out.querySelectorAll('[data-tab]'), function (b) {
      b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); store.set('deskTab', state.tab); say(''); drawDesk(); });
    });
    var view = out.querySelector('[data-view]');
    ({ check: drawCheck, recent: drawRecent, members: drawMembers, roles: drawRoles, clubs: drawClubs, office: drawOffice, admin: drawAdmin }[state.tab] || function () {})(view);
  }

  // A moderator given zones sees their zones' clubs first; the others follow under "Other zones"
  function inZone(c) {
    var zones = (state.data.me && state.data.me.zones) || [];
    return !zones.length || zones.indexOf(c.zone) >= 0;
  }
  function byZone(list) {
    return { mine: list.filter(inZone), others: list.filter(function (c) { return !inZone(c); }) };
  }

  function drawCheck(view) {
    var items = state.data.content.pending;
    var clean = items.filter(function (c) { return c.clean; });
    var look = items.filter(function (c) { return !c.clean; });
    if (!state.sub || (state.sub === 'clean' && !clean.length && look.length)) state.sub = clean.length ? 'clean' : 'look';
    var h = '<nav class="desk-tabs desk-subtabs" aria-label="To check">' + [['clean', t('subClean'), clean.length], ['look', t('subLook'), look.length]].map(function (x) {
      return '<button type="button" data-sub="' + x[0] + '"' + (x[0] === state.sub ? ' aria-current="true"' : '') + '>' + esc(x[1]) + (x[2] ? ' <span class="desk-count">' + x[2] + '</span>' : '') + '</button>';
    }).join('') + '</nav><div data-subview></div>';
    view.innerHTML = h;
    Array.prototype.forEach.call(view.querySelectorAll('[data-sub]'), function (b) {
      b.addEventListener('click', function () { state.sub = b.getAttribute('data-sub'); say(''); drawCheck(view); });
    });
    var sub = view.querySelector('[data-subview]');
    if (state.sub === 'clean') drawClean(sub, clean); else drawLook(sub, look);
  }

  function drawLook(view, look) {
    if (!look.length) { view.innerHTML = '<p class="desk-empty">' + esc(t('nothing')) + '</p>'; return; }
    var z = byZone(look);
    view.innerHTML = '<p class="small muted">' + esc(t('lookIntro')) + '</p>' + z.mine.map(function (c) { return itemHtml(c); }).join('') +
      (z.others.length ? '<h2>' + esc(t('otherZones')) + ' (' + z.others.length + ')</h2>' + z.others.map(function (c) { return itemHtml(c); }).join('') : '');
    wireCards(look);
  }

  var CLEAN_PAGE = 20;
  function drawClean(view, clean) {
    if (!clean.length) { view.innerHTML = '<p class="desk-empty">' + esc(t('nothing')) + '</p>'; return; }
    var z = byZone(clean);
    var ordered = z.mine.concat(z.others);
    var shown = ordered.slice(0, state.cleanShown || CLEAN_PAGE);
    var row = function (c) {
      return '<li class="desk-row desk-clean"><label class="desk-tick"><input type="checkbox" data-pick="' + esc(c.id) + '" checked></label>' +
        '<div class="desk-clean-text"><strong>' + esc(c.title) + '</strong><br><span class="small muted">' + esc([c.club, day(c.date)].filter(Boolean).join(' · ')) + '</span>' +
        (c.text ? '<br><span class="small">' + esc(c.text.length > 160 ? c.text.slice(0, 160) + '…' : c.text) + '</span>' : '') + '</div>' +
        photosHtml(c.photos.slice(0, 3)).replace(/<p class="small muted">[^<]*<\/p>$/, '') + '</li>';
    };
    var mine = shown.filter(inZone);
    var others = shown.filter(function (c) { return !inZone(c); });
    view.innerHTML = '<p class="small muted">' + esc(t('cleanIntro')) + '</p>' +
      '<ul class="desk-list">' + mine.map(row).join('') + '</ul>' +
      (others.length ? '<h2>' + esc(t('otherZones')) + '</h2><ul class="desk-list">' + others.map(row).join('') + '</ul>' : '') +
      (ordered.length > shown.length ? '<p><button type="button" class="btn-small" data-more>' + esc(t('showMore')) + '</button></p>' : '') +
      '<p class="desk-actions"><button type="button" class="btn btn-go" data-approve-many></button></p>';
    loadPhotos(view);
    var btn = view.querySelector('[data-approve-many]');
    var picked = function () { return Array.prototype.filter.call(view.querySelectorAll('[data-pick]'), function (x) { return x.checked; }).map(function (x) { return x.getAttribute('data-pick'); }); };
    var label = function () { var n = picked().length; btn.textContent = t('approveTicked').replace('{n}', n); btn.disabled = !n; };
    label();
    Array.prototype.forEach.call(view.querySelectorAll('[data-pick]'), function (x) {
      x.addEventListener('change', function () {
        // unticked: it needs a full look, so it moves there
        if (!x.checked) clean.forEach(function (c) { if (c.id === x.getAttribute('data-pick')) c.clean = false; });
        label();
      });
    });
    var more = view.querySelector('[data-more]');
    if (more) more.addEventListener('click', function () { state.cleanShown = (state.cleanShown || CLEAN_PAGE) + CLEAN_PAGE; drawClean(view, clean); });
    btn.addEventListener('click', function () {
      var ids = picked();
      if (!ids.length || !window.confirm(t('confirmMany').replace('{n}', ids.length))) return;
      btn.disabled = true;
      say(t('working'));
      api({ fn: 'approveclean', ids: ids }).then(function (d) { say(d.message); state.cleanShown = 0; reload(); }).catch(function (err) { btn.disabled = false; say(err.message, true); });
    });
  }

  // reads the desk again, keeping the message on screen
  function reload() {
    api({ fn: 'list' }).then(function (d) { state.data = d; drawDesk(); }).catch(function (err) { say(err.message, true); });
  }

  /* ---------- Small forms: fields plus a reason for the change log ---------- */

  function optionsHtml(options, value) {
    return options.map(function (o) {
      var v = Array.isArray(o) ? o[0] : o;
      var l = Array.isArray(o) ? o[1] : o;
      return '<option value="' + esc(v) + '"' + (String(v) === String(value) ? ' selected' : '') + '>' + esc(l) + '</option>';
    }).join('');
  }
  // fields: [name, label, value, kind ('text', 'date', 'select', 'zones'), options]; a reason box follows unless noReason
  function formPanel(panel, fields, submitLabel, reasonLabel, done) {
    panel.innerHTML = '<form class="desk-form">' + fields.map(function (f) {
      var kind = f[3] || 'text';
      if (kind === 'select') return '<label>' + esc(f[1]) + '<select name="' + esc(f[0]) + '">' + optionsHtml(f[4], f[2]) + '</select></label>';
      if (kind === 'zones') {
        var on = String(f[2] || '').split(/,\s*/);
        return '<fieldset class="desk-zones"><legend>' + esc(f[1]) + '</legend>' + f[4].map(function (z) {
          return '<label class="desk-inline"><input type="checkbox" name="' + esc(f[0]) + '" value="' + esc(z) + '"' + (on.indexOf(z) >= 0 ? ' checked' : '') + '> ' + esc(z) + '</label>';
        }).join(' ') + '</fieldset>';
      }
      return '<label>' + esc(f[1]) + '<input name="' + esc(f[0]) + '" type="' + (kind === 'date' ? 'date' : 'text') + '" value="' + esc(f[2] == null ? '' : f[2]) + '"></label>';
    }).join('') + (reasonLabel ? '<label>' + esc(reasonLabel) + '<textarea name="reason" rows="2" required maxlength="500"></textarea></label>' : '') +
      '<button class="btn btn-go" type="submit">' + esc(submitLabel) + '</button> <button class="btn-small" type="button" data-cancel>' + esc(t('cancel')) + '</button></form>';
    var form = panel.querySelector('form');
    panel.querySelector('[data-cancel]').addEventListener('click', function () { panel.innerHTML = ''; });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var values = {};
      fields.forEach(function (f) {
        if ((f[3] || 'text') === 'zones') values[f[0]] = Array.prototype.filter.call(form.querySelectorAll('[name="' + f[0] + '"]'), function (x) { return x.checked; }).map(function (x) { return x.value; }).join(', ');
        else values[f[0]] = form[f[0]].value;
      });
      done(values, reasonLabel ? form.reason.value.trim() : '', form);
    });
  }
  function send(payload, after) {
    say(t('working'));
    return api(payload).then(function (d) { say(d.message); if (after) after(d); return d; }).catch(function (err) { say(err.message, true); });
  }
  function clubOptions(withBlank) {
    var list = ((state.data.lists || {}).clubs || []).map(function (c) { return [c.id, c.name]; });
    return withBlank ? [['', withBlank]].concat(list) : list;
  }

  function toggle(label, on, attrs) {
    return '<button type="button" class="desk-toggle" aria-pressed="' + (on ? 'true' : 'false') + '" ' + attrs + '>' + esc(label) + '</button>';
  }

  function drawRecent(view) {
    var c = state.data.content;
    var row = function (x, story) {
      if (x.hidden) {
        return '<li class="desk-row desk-done"><div><strong>' + esc(x.title) + '</strong><br><span class="small muted">' + esc([x.club, day(x.date), t('hidden')].filter(Boolean).join(' · ')) + '</span></div><div>' +
          '<button type="button" class="btn-small" data-putback="' + esc(x.id) + '">' + esc(t('putBackSite')) + '</button></div></li>';
      }
      return '<li class="desk-row"><div><strong>' + esc(x.title) + '</strong><br><span class="small muted">' + esc([x.club, day(x.date)].filter(Boolean).join(' · ')) + '</span></div><div>' +
        (story ? toggle(t('story'), x.story, 'data-flag="story_of_month" data-tab-name="' + x.tab + '" data-id="' + esc(x.id) + '"') : '') +
        toggle(t('leaveOut'), x.left_out, 'data-flag="bulletin_exclude" data-tab-name="' + x.tab + '" data-id="' + esc(x.id) + '"') +
        (story ? '<button type="button" class="btn-small btn-no-small" data-hide="' + esc(x.id) + '">' + esc(t('hide')) + '</button>' : '') + '</div><div class="desk-panel" data-hide-panel="' + esc(x.id) + '"></div></li>';
    };
    view.innerHTML = '<h2>' + esc(t('recentActs')) + '</h2>' + (c.recent.length ? '<ul class="desk-list">' + c.recent.map(function (x) { return row(x, true); }).join('') + '</ul>' : '<p>' + esc(t('none')) + '</p>') +
      '<h2>' + esc(t('upcoming')) + '</h2>' + (c.upcoming.length ? '<ul class="desk-list">' + c.upcoming.map(function (x) { return row(x, false); }).join('') + '</ul>' : '<p>' + esc(t('none')) + '</p>');
    Array.prototype.forEach.call(view.querySelectorAll('[data-hide]'), function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-hide');
        formPanel(view.querySelector('[data-hide-panel="' + id + '"]'), [], t('hide'), t('hideReason'), function (v, reason) {
          send({ fn: 'hide', id: id, reason: reason }, function () { c.recent.forEach(function (x) { if (x.id === id) x.hidden = true; }); drawRecent(view); });
        });
      });
    });
    Array.prototype.forEach.call(view.querySelectorAll('[data-putback]'), function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-putback');
        send({ fn: 'putback', id: id }, function () { c.recent.forEach(function (x) { if (x.id === id) x.hidden = false; }); drawRecent(view); });
      });
    });
    Array.prototype.forEach.call(view.querySelectorAll('[data-flag]'), function (b) {
      b.addEventListener('click', function () {
        var on = b.getAttribute('aria-pressed') !== 'true';
        say(t('working'));
        api({ fn: 'flag', tab: b.getAttribute('data-tab-name'), id: b.getAttribute('data-id'), field: b.getAttribute('data-flag'), value: on }).then(function (d) {
          b.setAttribute('aria-pressed', d.value ? 'true' : 'false');
          var list = b.getAttribute('data-tab-name') === 'events' ? c.upcoming : c.recent;
          list.forEach(function (x) { if (x.id === b.getAttribute('data-id')) x[b.getAttribute('data-flag') === 'story_of_month' ? 'story' : 'left_out'] = d.value; });
          say(d.message);
        }).catch(function (err) { say(err.message, true); });
      });
    });
  }

  function drawMembers(view) {
    var m = state.data.members;
    var h = '<h2>' + esc(t('consent')) + ' (' + m.consent.length + ')</h2>';
    if (!m.consent.length) h += '<p>' + esc(t('none')) + '</p>';
    m.consent.forEach(function (r) {
      h += '<article class="desk-card" data-member="consent|' + esc(r.id) + '"><p class="desk-kind">' + esc(r.id) + ' · ' + esc(day(r.submitted)) + '</p><h2>' + esc(r.name) + '</h2>' +
        '<p class="muted">' + esc(r.club) + (r.filledBy ? ' · ' + esc(r.filledBy) : '') + '</p><p class="small">' + esc(r.match) + '</p>' +
        (r.sentFrom ? '<p class="small">' + esc(t('sentFrom')) + ': ' + esc(r.sentFrom) + (r.sender ? ' · ' + esc(r.sender) : '') + '</p>' : '') +
        (r.memberNotice ? '<p class="small">' + esc(t('memberTold')) + ': ' + esc(r.memberNotice) + '</p>' : '') +
        (r.warnings.length ? '<p class="desk-note">' + r.warnings.map(esc).join('<br>') + '</p>' : '') +
        (r.holdUntil ? '<p class="desk-note">' + esc(t('holdUntil').replace('{day}', day(r.holdUntil))) + '</p>' : '') +
        '<ul>' + r.choices.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
        (r.description ? '<p class="desk-text">“' + esc(r.description) + '”</p>' : '') +
        photosHtml([r.photoRef, r.couplePhotoRef].filter(Boolean)) +
        (!r.blocked && (r.needsConfirm || r.holdUntil) ? '<label class="desk-confirm"><input type="checkbox" data-confirmed> ' + esc(t('confirmed')) + '</label>' : '') +
        '<div class="desk-actions" data-actions>' + (r.blocked ? '' : '<button type="button" class="btn btn-go" data-m="approve">' + esc(t('approve')) + '</button>') +
        '<button type="button" class="btn btn-no" data-m="reject">' + esc(t('reject')) + '</button></div><div data-panel></div></article>';
    });
    h += '<h2>' + esc(t('removal')) + ' (' + m.removal.length + ')</h2>';
    if (!m.removal.length) h += '<p>' + esc(t('none')) + '</p>';
    m.removal.forEach(function (r) {
      h += '<article class="desk-card" data-member="removal|' + esc(r.id) + '"><p class="desk-kind">' + esc(r.id) + ' · ' + esc(day(r.submitted)) + '</p><h2>' + esc(r.name) + '</h2>' +
        '<p class="muted">' + esc(r.club) + '</p><p class="small">' + esc(r.match) + '</p><p><strong>' + esc(r.items) + '</strong></p>' +
        (r.reason ? '<p class="desk-text">' + esc(r.reason) + '</p>' : '') +
        '<div class="desk-actions" data-actions><button type="button" class="btn btn-go" data-m="approve">' + esc(t('removeNow')) + '</button>' +
        '<button type="button" class="btn btn-no" data-m="reject">' + esc(t('reject')) + '</button></div><div data-panel></div></article>';
    });
    var changes = m.change || [];
    h += '<h2>' + esc(t('changes')) + ' (' + changes.length + ')</h2>';
    if (!changes.length) h += '<p>' + esc(t('none')) + '</p>';
    changes.forEach(function (r) {
      h += '<article class="desk-card" data-member="change|' + esc(r.id) + '"><p class="desk-kind">' + esc(r.id) + ' · ' + esc(day(r.submitted)) + '</p><h2>' + esc(r.name) + '</h2>' +
        '<p class="muted">' + esc(r.club) + '</p><p><strong>' + esc(r.change) + '</strong></p>' +
        '<dl class="desk-lines">' + r.lines.map(function (l) { return '<dt>' + esc(l[0]) + '</dt><dd>' + esc(l[1]) + '</dd>'; }).join('') + '</dl>' +
        '<p class="small">' + esc(r.now) + '</p>' +
        (r.sentFrom ? '<p class="small">' + esc(t('sentFrom')) + ': ' + esc(r.sentFrom) + '</p>' : '') +
        (r.warnings.length ? '<p class="desk-note">' + r.warnings.map(esc).join('<br>') + '</p>' : '') +
        (r.note ? '<p class="desk-text">' + esc(r.note) + '</p>' : '') +
        (r.kind === 'deceased' ? '<label class="desk-confirm"><input type="checkbox" data-confirmed> ' + esc(t('confirmClub')) + '</label>' : '') +
        '<div class="desk-actions" data-actions><button type="button" class="btn btn-go" data-m="approve">' + esc(t('approve')) + '</button>' +
        '<button type="button" class="btn btn-no" data-m="reject">' + esc(t('reject')) + '</button></div><div data-panel></div></article>';
    });
    if (m.waiting.length) {
      h += '<h2>' + esc(t('couples')) + ' (' + m.waiting.length + ')</h2><ul class="desk-list">' + m.waiting.map(function (c) {
        return '<li class="desk-row"><div><strong>' + esc(c.names) + '</strong><br><span class="small muted">' + esc(c.status === 'check_dates' ? t('datesDiffer') : t('waitingSpouse')) + '</span></div></li>';
      }).join('') + '</ul>';
    }
    h += '<h2>' + esc(t('findMember')) + '</h2><form class="desk-form desk-search" data-search><label>' + esc(t('findHint')) +
      '<input name="q" minlength="3" required></label><button class="btn-small" type="submit">' + esc(t('search')) + '</button></form><div data-people></div>' +
      '<h2>' + esc(t('recentChanges')) + '</h2><div data-changes><button type="button" class="btn-small" data-load-changes>' + esc(t('recentChanges')) + '</button></div>';
    view.innerHTML = h;
    loadPhotos(view);
    Array.prototype.forEach.call(view.querySelectorAll('[data-member]'), function (el) {
      var parts = el.getAttribute('data-member').split('|');
      var panel = el.querySelector('[data-panel]');
      var finish = function (d) {
        say(d.message); el.classList.add('desk-done'); el.querySelector('[data-actions]').remove(); panel.innerHTML = '';
        var tick = el.querySelector('.desk-confirm'); if (tick) tick.remove();
      };
      Array.prototype.forEach.call(el.querySelectorAll('[data-m]'), function (b) {
        b.addEventListener('click', function () {
          if (b.getAttribute('data-m') === 'approve') {
            say(t('working'));
            var tick = el.querySelector('[data-confirmed]');
            api({ fn: 'member', kind: parts[0], action: 'approve', id: parts[1], confirmed: !!(tick && tick.checked) }).then(finish).catch(function (err) { say(err.message, true); });
          } else {
            rejectPanel(panel, function (reason) {
              say(t('working'));
              api({ fn: 'member', kind: parts[0], action: 'reject', id: parts[1], reason: reason }).then(finish).catch(function (err) { say(err.message, true); });
            });
          }
        });
      });
    });
    view.querySelector('[data-load-changes]').addEventListener('click', function () { drawChanges(view.querySelector('[data-changes]')); });
    view.querySelector('[data-search]').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var box = view.querySelector('[data-people]');
      say(t('working'));
      api({ fn: 'search', q: ev.target.q.value }).then(function (d) {
        say('');
        box.innerHTML = d.people.length ? '<ul class="desk-list">' + d.people.map(function (p) {
          return '<li class="desk-row' + (p.status !== 'active' ? ' desk-done' : '') + '"><div><strong>' + esc(p.name) + '</strong><br><span class="small muted">' +
            esc([p.club, p.member_id, statusLabel(p.status)].join(' · ')) + '</span></div>' +
            '<div><button type="button" class="btn-small" data-edit-member="' + esc(p.member_id) + '">' + esc(t('edit')) + '</button>' +
            (p.status === 'active' ? '<button type="button" class="btn-small btn-no-small" data-dead="' + esc(p.member_id) + '" data-name="' + esc(p.name) + '">' + esc(t('deceased')) + '</button>' : '') +
            '</div><div class="desk-panel" data-member-panel="' + esc(p.member_id) + '"></div></li>';
        }).join('') + '</ul>' : '<p>' + esc(t('noOne')) + '</p>';
        Array.prototype.forEach.call(box.querySelectorAll('[data-edit-member]'), function (b) {
          b.addEventListener('click', function () {
            var p = d.people.filter(function (x) { return x.member_id === b.getAttribute('data-edit-member'); })[0];
            // the member's own club stays a choice even when it has closed, so saving never moves them by accident
            var clubs = clubOptions();
            if (!clubs.some(function (o) { return o[0] === p.club_id; })) clubs.unshift([p.club_id, p.club_id ? p.club : '–']);
            formPanel(box.querySelector('[data-member-panel="' + p.member_id + '"]'), [
              ['name', t('name2'), p.name], ['member_id', t('memberId'), p.member_id], ['club_id', t('club'), p.club_id, 'select', clubs],
              ['status', t('status'), p.status, 'select', [['active', t('active')], ['left', t('left')], ['deceased', t('deceasedS')]]],
              ['mobile', t('mobile'), p.mobile], ['email', t('emailF'), p.email],
            ], t('save'), t('reasonLog'), function (v, reason) {
              send({ fn: 'membersave', member_id: p.member_id, fields: v, reason: reason }, function () { ev.target.dispatchEvent(new Event('submit')); });
            });
          });
        });
        Array.prototype.forEach.call(box.querySelectorAll('[data-dead]'), function (b) {
          b.addEventListener('click', function () {
            if (!window.confirm(t('confirmDeceased').replace('{name}', b.getAttribute('data-name')))) return;
            say(t('working'));
            api({ fn: 'deceased', member_id: b.getAttribute('data-dead') }).then(function (r) { say(r.message); b.closest('li').remove(); }).catch(function (err) { say(err.message, true); });
          });
        });
      }).catch(function (err) { say(err.message, true); });
    });
  }

  function statusLabel(s) { return s === 'left' ? t('left') : s === 'deceased' ? t('deceasedS') : t('active'); }

  // the change log: newest first, with Undo while nothing has changed since
  function drawChanges(box) {
    say(t('working'));
    api({ fn: 'changes' }).then(function (d) {
      say('');
      box.innerHTML = d.changes.length ? '<ul class="desk-list">' + d.changes.map(function (c) {
        return '<li class="desk-row' + (c.undone ? ' desk-done' : '') + '"><div><strong>' + esc(c.action) + ' · ' + esc(c.key) + '</strong><br><span class="small muted">' +
          esc(day(c.at) + ' · ' + c.by + (c.reason ? ' · ' + c.reason : '')) + '</span><br><span class="small">' + c.lines.map(esc).join('<br>') + '</span></div><div>' +
          (c.undone ? '<span class="small">' + esc(t('undone')) + '</span>' : c.can_undo ? '<button type="button" class="btn-small" data-undo="' + esc(c.id) + '">' + esc(t('undo')) + '</button>' : '') + '</div></li>';
      }).join('') + '</ul>' : '<p>' + esc(t('none')) + '</p>';
      Array.prototype.forEach.call(box.querySelectorAll('[data-undo]'), function (b) {
        b.addEventListener('click', function () { send({ fn: 'undo', id: b.getAttribute('data-undo') }, function () { drawChanges(box); }); });
      });
    }).catch(function (err) { say(err.message, true); });
  }

  /* ---------- Roles: office bearers (Content or Members) and district roles (Members) ---------- */

  function drawRoles(view) {
    var checks = (state.data.roles && state.data.roles.checks) || [];
    var L = state.data.lists || {};
    var h = '';
    if (state.data.members) {
      h += '<h2>' + esc(t('roleChecks')) + ' (' + checks.length + ')</h2>' + (checks.length ? '<ul class="desk-list">' + checks.map(function (p, i) {
        return '<li class="desk-row"><div><strong>' + esc(p.name || '–') + '</strong>' + (p.member_id ? ' · ' + esc(p.member_id) : '') + '<br><span class="small muted">' +
          esc(p.tab + ' · ' + p.rotary_year) + '</span><br><span class="small">' + esc(p.problem) + '</span></div><div>' +
          '<button type="button" class="btn-small" data-check="' + i + '">' + esc(t('open')) + '</button></div></li>';
      }).join('') + '</ul>' : '<p>' + esc(t('none')) + '</p>');
    }
    h += '<h2>' + esc(t('findRole')) + '</h2><form class="desk-form desk-search" data-role-search><label>' + esc(t('roleHint')) +
      '<input name="q" required></label><button class="btn-small" type="submit">' + esc(t('search')) + '</button></form><div data-roles></div>' +
      '<h2>' + esc(t('addOfficer')) + '</h2><div data-add-officer></div>' +
      '<h2>' + esc(t('recentChanges')) + '</h2><div data-changes><button type="button" class="btn-small" data-load-changes>' + esc(t('recentChanges')) + '</button></div>';
    view.innerHTML = h;
    var box = view.querySelector('[data-roles]');
    var search = function (q) {
      say(t('working'));
      api({ fn: 'roles', q: q }).then(function (d) { say(''); drawRoleList(box, d.roles, function () { search(q); }); }).catch(function (err) { say(err.message, true); });
    };
    view.querySelector('[data-role-search]').addEventListener('submit', function (ev) { ev.preventDefault(); search(ev.target.q.value.trim()); });
    Array.prototype.forEach.call(view.querySelectorAll('[data-check]'), function (b) {
      b.addEventListener('click', function () {
        var p = checks[+b.getAttribute('data-check')];
        var q = p.member_id || p.name;
        view.querySelector('[data-role-search]').q.value = q;
        search(q);
      });
    });
    formPanel(view.querySelector('[data-add-officer]'), [
      ['club_id', t('club'), '', 'select', clubOptions('–')], ['rotary_year', t('year'), (L.years || [])[0], 'select', L.years || []],
      ['role', t('role'), 'President', 'select', L.club_roles || []], ['member_id', t('memberId'), ''],
    ], t('addOfficer'), t('reasonLog'), function (v, reason, form) {
      send({ fn: 'roleadd', fields: v, reason: reason }, function () { form.reset(); });
    });
    view.querySelector('[data-add-officer] [data-cancel]').remove();
    view.querySelector('[data-load-changes]').addEventListener('click', function () { drawChanges(view.querySelector('[data-changes]')); });
  }

  function drawRoleList(box, roles, again) {
    var L = state.data.lists || {};
    box.innerHTML = roles.length ? '<ul class="desk-list">' + roles.map(function (r, i) {
      return '<li class="desk-row' + (r.ended_on ? ' desk-done' : '') + '"><div><strong>' + esc(r.role) + ' · ' + esc(r.rotary_year) + '</strong><br>' + esc(r.name) +
        (r.member_id ? ' (' + esc(r.member_id) + ')' : '') + '<br><span class="small muted">' + esc([r.club, r.section, r.committee].filter(Boolean).join(' · ')) +
        (r.ag && r.ag_clubs ? '<br>' + esc(r.ag_clubs) : '') + (r.ended_on ? ' · ' + esc(t('ended')) + ' ' + esc(day(r.ended_on)) : '') + '</span></div><div>' +
        (r.ended_on ? '' : '<button type="button" class="btn-small" data-role-edit="' + i + '">' + esc(t('change')) + '</button>' +
          '<button type="button" class="btn-small btn-no-small" data-role-end="' + i + '">' + esc(t('endRole')) + '</button>') +
        '</div><div class="desk-panel" data-role-panel="' + i + '"></div></li>';
    }).join('') + '</ul>' : '<p>' + esc(t('noOne')) + '</p>';
    Array.prototype.forEach.call(box.querySelectorAll('[data-role-edit]'), function (b) {
      b.addEventListener('click', function () {
        var i = b.getAttribute('data-role-edit');
        var r = roles[+i];
        var fields = [['member_id', t('memberId'), r.member_id]];
        if (r.tab === 'officers' && (L.club_roles || []).indexOf(r.role) >= 0) fields.push(['role', t('role'), r.role, 'select', L.club_roles]);
        if (r.ag) fields.push(['ag_clubs', t('agClubs'), r.ag_clubs], ['zone', t('zone'), r.zone, 'select', [['', '–']].concat(L.zones || [])]);
        formPanel(box.querySelector('[data-role-panel="' + i + '"]'), fields, t('save'), t('reasonLog'), function (v, reason) {
          send({ fn: 'rolesave', tab: r.tab, row: r.row, fields: v, reason: reason }, again);
        });
      });
    });
    Array.prototype.forEach.call(box.querySelectorAll('[data-role-end]'), function (b) {
      b.addEventListener('click', function () {
        var i = b.getAttribute('data-role-end');
        var r = roles[+i];
        formPanel(box.querySelector('[data-role-panel="' + i + '"]'), [], t('endRole'), t('endReason'), function (v, reason) {
          send({ fn: 'roleend', tab: r.tab, row: r.row, reason: reason }, again);
        });
      });
    });
  }

  /* ---------- Admin: clubs and moderators (Administrators) ---------- */

  function drawAdmin(view) {
    var a = state.data.admin;
    var L = state.data.lists || {};
    var h = '<h2>' + esc(t('clubsAdmin')) + '</h2><details><summary class="btn-small">' + esc(t('addClub')) + '</summary><div data-add-club></div></details>' +
      '<form class="desk-form desk-search" data-club-filter><label>' + esc(t('filterClubs')) + '<input name="q"></label></form><div data-club-list></div>' +
      '<h2>' + esc(t('moderatorsAdmin')) + '</h2><details><summary class="btn-small">' + esc(t('addModerator')) + '</summary><div data-add-mod></div></details><div data-mod-list></div>' +
      '<h2>' + esc(t('recentChanges')) + '</h2><div data-changes><button type="button" class="btn-small" data-load-changes>' + esc(t('recentChanges')) + '</button></div>';
    view.innerHTML = h;
    formPanel(view.querySelector('[data-add-club]'), [
      ['club_id', t('clubId'), ''], ['club_name', t('clubName'), ''], ['city', t('city'), ''], ['zone', t('zone'), '', 'select', [['', '–']].concat(L.zones || [])],
      ['charter_date', t('charter'), '', 'date'],
    ], t('addClub'), t('reasonLog'), function (v, reason) { send({ fn: 'clubadd', fields: v, reason: reason }, reload); });
    var list = view.querySelector('[data-club-list]');
    var drawList = function (q) {
      var want = String(q || '').toLowerCase();
      var clubs = a.clubs.filter(function (c) { return !want || (c.club_name + ' ' + c.club_id + ' ' + c.city).toLowerCase().indexOf(want) >= 0; }).slice(0, want ? 60 : 20);
      list.innerHTML = '<ul class="desk-list">' + clubs.map(function (c) {
        return '<li class="desk-row' + (c.status !== 'active' ? ' desk-done' : '') + '"><div><strong>' + esc(c.club_name) + '</strong><br><span class="small muted">' +
          esc([c.club_id, c.city, c.zone, c.member_count + ' ' + t('members'), c.charter_date ? t('charter') + ' ' + day(c.charter_date) : '', c.status !== 'active' ? t('closed') + (c.merged_into ? ' → ' + c.merged_into : '') : ''].filter(Boolean).join(' · ')) +
          '</span></div><div>' + (c.status === 'active' ? '<button type="button" class="btn-small" data-club-edit="' + esc(c.club_id) + '">' + esc(t('edit')) + '</button>' +
          '<button type="button" class="btn-small btn-no-small" data-club-close="' + esc(c.club_id) + '">' + esc(t('closeClub')) + '</button>' : '') +
          '</div><div class="desk-panel" data-club-panel="' + esc(c.club_id) + '"></div></li>';
      }).join('') + '</ul>';
      Array.prototype.forEach.call(list.querySelectorAll('[data-club-edit]'), function (b) {
        b.addEventListener('click', function () {
          var c = a.clubs.filter(function (x) { return x.club_id === b.getAttribute('data-club-edit'); })[0];
          formPanel(list.querySelector('[data-club-panel="' + c.club_id + '"]'), [
            ['club_name', t('clubName'), c.club_name], ['city', t('city'), c.city], ['zone', t('zone'), c.zone, 'select', [['', '–']].concat(L.zones || [])],
            ['charter_date', t('charter'), c.charter_date, 'date'],
          ], t('save'), t('reasonLog'), function (v, reason) { send({ fn: 'clubsave', club_id: c.club_id, fields: v, reason: reason }, reload); });
        });
      });
      Array.prototype.forEach.call(list.querySelectorAll('[data-club-close]'), function (b) {
        b.addEventListener('click', function () {
          var c = a.clubs.filter(function (x) { return x.club_id === b.getAttribute('data-club-close'); })[0];
          var others = clubOptions().filter(function (o) { return o[0] !== c.club_id; }).map(function (o) { return [o[0], t('moveInto') + o[1]]; });
          formPanel(list.querySelector('[data-club-panel="' + c.club_id + '"]'), [['move_to', t('moveTo'), '', 'select', [['', t('markLeft')]].concat(others)]],
            t('closeClub'), t('reasonLog'), function (v, reason) {
              if (!window.confirm(t('confirmClose').replace('{name}', c.club_name))) return;
              send({ fn: 'clubclose', club_id: c.club_id, move_to: v.move_to, reason: reason }, reload);
            });
        });
      });
    };
    drawList('');
    view.querySelector('[data-club-filter]').addEventListener('submit', function (ev) { ev.preventDefault(); });
    view.querySelector('[data-club-filter]').q.addEventListener('input', function (ev) { drawList(ev.target.value); });

    var modFields = function (m) {
      return [['type', t('type'), m.type || 'Content', 'select', L.moderator_types || []], ['name', t('name2'), m.name || ''], ['email', t('email2'), m.email || ''],
        ['zone', t('zone'), m.zone || '', 'zones', L.zones || []], ['active', t('isActive'), m.active === false ? 'FALSE' : 'TRUE', 'select', [['TRUE', t('yes')], ['FALSE', t('no')]]]];
    };
    formPanel(view.querySelector('[data-add-mod]'), modFields({}), t('addModerator'), t('reasonLog'), function (v, reason) { send({ fn: 'modsave', row: '', fields: v, reason: reason }, reload); });
    var mods = view.querySelector('[data-mod-list]');
    mods.innerHTML = '<ul class="desk-list">' + a.moderators.map(function (m) {
      return '<li class="desk-row' + (m.active ? '' : ' desk-done') + '"><div><strong>' + esc(m.name) + '</strong> · ' + esc(m.type) + '<br><span class="small muted">' +
        esc([m.email, m.type === 'Content' ? (m.zone || t('allZones')) : '', m.active ? '' : t('no') + ' ' + t('isActive').toLowerCase()].filter(Boolean).join(' · ')) + '</span></div>' +
        '<div><button type="button" class="btn-small" data-mod-edit="' + m.row + '">' + esc(t('edit')) + '</button></div><div class="desk-panel" data-mod-panel="' + m.row + '"></div></li>';
    }).join('') + '</ul>';
    Array.prototype.forEach.call(mods.querySelectorAll('[data-mod-edit]'), function (b) {
      b.addEventListener('click', function () {
        var m = a.moderators.filter(function (x) { return String(x.row) === b.getAttribute('data-mod-edit'); })[0];
        formPanel(mods.querySelector('[data-mod-panel="' + m.row + '"]'), modFields(m), t('save'), t('reasonLog'), function (v, reason) {
          send({ fn: 'modsave', row: m.row, fields: v, reason: reason }, reload);
        });
      });
    });
    view.querySelector('[data-load-changes]').addEventListener('click', function () { drawChanges(view.querySelector('[data-changes]')); });
  }

  function drawClubs(view) {
    var clubs = state.data.clubs;
    view.innerHTML = '<p class="muted">' + esc(t('quietIntro')) + '</p>' + (clubs.length ? '<ul class="desk-list">' + clubs.map(function (c) {
      return '<li class="desk-row desk-club"><div><strong>' + esc(c.club_name) + '</strong><br><span class="small muted">' + esc(c.zone) + ' · ' + esc(t('lastActivity')) + ': ' +
        esc(c.last_activity_date ? day(c.last_activity_date) : t('never')) + '</span>' +
        (c.reminded_at ? '<br><span class="small">' + esc(t('reminded')) + ' ' + esc(day(c.reminded_at)) + ' ' + esc(t('by')) + ' ' + esc(c.reminded_by) + ' (' + esc(c.reminded_via) + ')</span>' : '') +
        '</div><div>' + (c.can_email ? '<button type="button" class="btn-small" data-nudge="' + esc(c.club_id) + '">' + esc(t('emailClub')) + '</button>' : '') +
        '<a class="btn-small btn-wa" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(c.whatsapp) + '" data-wa="' + esc(c.club_id) + '">' + esc(t('whatsapp')) + '</a></div></li>';
    }).join('') + '</ul>' : '<p class="desk-empty">' + esc(t('nothing')) + '</p>');
    Array.prototype.forEach.call(view.querySelectorAll('[data-nudge]'), function (b) {
      b.addEventListener('click', function () {
        say(t('working'));
        api({ fn: 'nudge', club_id: b.getAttribute('data-nudge'), via: 'email' }).then(function (d) { say(d.message); b.remove(); }).catch(function (err) { say(err.message, true); });
      });
    });
    Array.prototype.forEach.call(view.querySelectorAll('[data-wa]'), function (a) {
      a.addEventListener('click', function () { api({ fn: 'nudge', club_id: a.getAttribute('data-wa'), via: 'whatsapp' }).catch(function () { /* only a note */ }); });
    });
  }

  function drawOffice(view) {
    var list = state.data.office;
    view.innerHTML = list.length ? list.map(function (m) {
      return '<article class="desk-card" data-msg-id="' + esc(m.id) + '"><p class="desk-kind">' + esc(m.status === 'answered' ? t('answered') : t('newMsg')) + ' · ' + esc(day(m.submitted)) + '</p>' +
        '<h2>' + esc(m.topic) + '</h2><p class="muted">' + esc([m.name, m.city].filter(Boolean).join(' · ')) + '</p><p class="desk-text">' + esc(m.message) + '</p>' +
        (m.note ? '<p class="small muted">' + esc(m.note) + '</p>' : '') +
        (m.replies ? '<p class="small"><strong>' + esc(t('earlier')) + ':</strong></p><p class="desk-text small">' + esc(m.replies) + '</p>' : '') +
        (m.reply_mobile && !m.reply_email ? '<p class="small">+' + esc(m.reply_mobile) + ' · ' + esc(t('phoneOnly')) + '</p>' : '') +
        (!m.reply_email && !m.reply_mobile ? '<p class="small">' + esc(m.reply_to) + '</p>' : '') + '<div class="desk-actions">' +
        (m.reply_email ? '<button type="button" class="btn-small" data-reply="' + esc(m.id) + '">' + esc(t('reply')) + '</button>' : '') +
        (m.status !== 'answered' ? '<button type="button" class="btn-small" data-answered="' + esc(m.id) + '">' + esc(t('markAnswered')) + '</button>' : '') +
        '</div><div class="desk-panel"></div></article>';
    }).join('') : '<p class="desk-empty">' + esc(t('nothing')) + '</p>';
    Array.prototype.forEach.call(view.querySelectorAll('[data-reply]'), function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-reply');
        var panel = b.closest('article').querySelector('.desk-panel');
        panel.innerHTML = '<form class="desk-form"><label>' + esc(t('replyLabel')) + '<textarea name="text" rows="6" required maxlength="3000"></textarea></label>' +
          '<button class="btn" type="submit">' + esc(t('send')) + '</button> <button class="btn-small" type="button" data-cancel>' + esc(t('cancel')) + '</button></form>';
        var form = panel.querySelector('form');
        panel.querySelector('[data-cancel]').addEventListener('click', function () { panel.innerHTML = ''; });
        form.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var text = form.text.value.trim();
          if (!text) return;
          form.querySelector('[type=submit]').disabled = true;
          say(t('working'));
          api({ fn: 'reply', id: id, text: text }).then(function (d) {
            say(d.message);
            list.forEach(function (m) { if (m.id === id) { m.status = 'answered'; m.replies = [m.replies, text].filter(Boolean).join('\n\n'); } });
            drawOffice(view);
          }).catch(function (err) { form.querySelector('[type=submit]').disabled = false; say(err.message, true); });
        });
        form.text.focus();
      });
    });
    Array.prototype.forEach.call(view.querySelectorAll('[data-answered]'), function (b) {
      b.addEventListener('click', function () {
        say(t('working'));
        api({ fn: 'answered', id: b.getAttribute('data-answered') }).then(function (d) {
          say(d.message);
          list.forEach(function (m) { if (m.id === b.getAttribute('data-answered')) m.status = 'answered'; });
          b.remove();
        }).catch(function (err) { say(err.message, true); });
      });
    });
  }

  function start() {
    if (!apiId) { out.innerHTML = '<p class="callout">' + esc(t('noApi')) + '</p>'; redraw = start; return; }
    if (session) load(); else showSignIn();
  }

  applyLang();
  ready.then(function () {
    if (!apiId) start();
    else if (hash.a) showLink(hash.a, hash['do']);
    else if (hash.s) showLinkSignIn(hash.s);
    else start();
  });
})();
