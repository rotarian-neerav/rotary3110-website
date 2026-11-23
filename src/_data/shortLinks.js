// The easy-to-share addresses (…/submit/ etc.) that forward to the Google Forms.
export default [
  { slug: 'submit', form: 'activity', title: "Share your club's activity or event", text: 'For club office bearers and members. Takes about two minutes. Google will ask you to sign in because the form accepts photos.' },
  { slug: 'club-profile', form: 'club_profile', title: "Update your club's links", text: "For club office bearers: your club's website, social media pages and meeting day and place." },
  { slug: 'consent', form: 'consent', title: 'Show my details', text: 'Choose what may be shown about you: directory listing, profession, photo, birthday, anniversary, Call and WhatsApp buttons. List or Do not list for each.' },
  { slug: 'update', form: 'update', title: 'Update my details', text: 'Correct your profession, photo, birthday or anniversary, the numbers for your Call and WhatsApp buttons, or add a second email.' },
  { slug: 'remove', form: 'removal', title: 'Stop showing my details', text: 'Send the Show my details form with Do not list for anything that should come off. From your own email it goes at the next website update.' },
  { slug: 'list-business', form: 'business', title: 'List your business: Rotary Means Business', text: 'For members of the Rotary clubs of District 3110: list your own business, and the topics you can speak on at club meetings, at the end of the Update my details form.' },
  { slug: 'club-changes', form: 'club_change', title: 'Tell us about members and roles', text: 'For clubs: a member who joined, left or passed away (a move: the old club sends "left", the new club "joined"), or who holds a club or district role. A Members moderator checks it before the website changes.' },
  { slug: 'public-service', form: 'public_service', title: 'Add a public service your club runs', text: 'For club office bearers: a blood bank, eye hospital, dialysis unit, clinic, library, skill centre or ambulance that the public can use. One form per facility.' },
];
