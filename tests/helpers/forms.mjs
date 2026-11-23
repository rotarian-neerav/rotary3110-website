// Release 2 (18 Nov 2026) replaced six forms by two with sections: Club updates (club details, members and roles, a
// public service) and My details on the website (show, remove, business listing). Tests written for the old forms
// still describe a submission by the old form's name; this sends it through the new form, choosing the section on
// page 1 and moving page 1's answers to the new form's own questions, as a person filling in the new form would.
//
// My details on the website was closed on 23 Nov 2026 (Show my details and Update my details replace it). An answer
// it still sends is filed as before, so the tests of its removal and business sections send through a closed copy.
export function routeOldForms(env) {
  const Q = env.context.Q;
  const U = env.context.CLUB_UPDATE_KINDS;
  const M = env.context.MY_DETAILS_KINDS;
  const submit = env.submit.bind(env);
  const move = (a, pairs) => {
    for (const [from, to] of pairs) {
      if (from in a) { const v = a[from]; delete a[from]; a[to] = v; }
    }
    return a;
  };
  env.oldMyDetails = () => {
    const ids = JSON.parse(env.props.get('FORM_IDS') || '{}');
    if (!ids.my_details) {
      const form = env.context.FormApp.create('My details on the website – Rotary District 3110');
      form.setAcceptingResponses(false);
      ids.my_details = form.getId();
      env.props.set('FORM_IDS', JSON.stringify(ids));
    }
    return ids.my_details;
  };
  env.submit = (key, answers, ...rest) => {
    const a = { ...answers };
    if (key === 'club_profile') return submit('club_updates', { ...a, [Q.uKind]: U.profile }, ...rest);
    if (key === 'public_service') return submit('club_updates', { ...a, [Q.uKind]: U.service }, ...rest);
    if (key === 'club_change') return submit('club_updates', { ...move(a, [[Q.cClub, Q.club]]), [Q.uKind]: U.member }, ...rest);
    if (['consent', 'removal', 'business', 'my_details'].includes(key)) env.oldMyDetails();
    if (key === 'consent') return submit('my_details', { ...a, [Q.mKind]: M.consent }, ...rest);
    if (key === 'removal') return submit('my_details', { ...move(a, [[Q.rName, Q.cName]]), [Q.mKind]: M.removal }, ...rest);
    if (key === 'business') {
      return submit('my_details', { ...move(a, [[Q.club, Q.cClub], [Q.name, Q.cName], [Q.bMemberId, Q.cMemberId], [Q.bMobile, Q.cMobile]]), [Q.mKind]: M.business }, ...rest);
    }
    return submit(key, answers, ...rest);
  };
  return env;
}
