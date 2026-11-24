/**
 * Tabs and columns of the two spreadsheets. Shared by the Sheet script and the
 * website's sample-data generator, so both always agree on the layout.
 */

var SCHEMA_MAIN = {
  settings: ['key', 'value', 'notes'],
  lists: ['list', 'value'],
  clubs: ['club_id', 'club_name', 'display_name', 'slug', 'former_names', 'city', 'zone', 'status', 'member_count',
    'meeting_day_place', 'website', 'facebook', 'instagram', 'youtube', 'x', 'linkedin', 'profile_updated_at', 'is_sample',
    'permanent_projects', 'regular_services',
    // added in Release A (17 October 2026); new columns always go at the end
    'meeting_day', 'activity_form_link',
    // added in Release 1 (18 November 2026): a new club is not nudged in its first 60 days; a closed club may name
    // the club its members moved to
    'charter_date', 'merged_into'],
  // ended_on (Release 1): a moderator ended the role on the desk; the row stays, the website no longer shows it
  // list_id: the Team lists import that added the row (B13, 24 Nov 2026), so a whole list can be withdrawn
  officers: ['rotary_year', 'club_id', 'member_id', 'name', 'role', 'contact_ok', 'contact_link', 'is_sample', 'ended_on', 'list_id'],
  functionaries: ['rotary_year', 'page', 'section', 'committee', 'member_id', 'name', 'role', 'zone', 'club_id', 'term',
    'sort_order', 'contact_ok', 'contact_link', 'is_sample', 'ag_clubs', 'ended_on', 'list_id'],
  activities: ['id', 'submitted_at', 'submitter_email', 'submitter_name', 'submitter_role', 'submitter_mobile', 'club_id',
    'club_name', 'title', 'date', 'theme', 'description', 'photo_files', 'post_link', 'people_helped', 'amount_spent', 'partner_clubs',
    'photo_consent', 'status', 'source', 'approved_by', 'approved_at', 'moderator_note', 'story_of_month', 'event_id',
    'notified', 'is_sample', 'campaign_id', 'campaign_count', 'bulletin_exclude',
    'avenue', 'video_link', 'press_paper', 'press_date', 'press_link',
    // added 17 November 2026: the sender marked it as district work (the moderator checks it)
    'district_level',
    // added 17 November 2026: one photo before and one after the work (shown side by side only when both are there)
    'before_photo', 'after_photo',
    // added in Release 1 (18 November 2026): a published activity a moderator took off the website (status hidden)
    'hidden_by', 'hidden_at',
    // added in Release 3 (18 November 2026): who sent it, while club_senders_only is watched or on
    'sender_check'],
  events: ['id', 'submitted_at', 'submitter_email', 'submitter_name', 'submitter_role', 'submitter_mobile', 'title',
    'event_type', 'start_date', 'start_time', 'end_date', 'venue', 'city', 'organiser', 'description', 'map_link',
    'details_link', 'photo_files', 'status', 'source', 'approved_by', 'approved_at', 'moderator_note', 'report_activity_id', 'notified',
    'is_sample', 'registration_close_date', 'fee', 'registration_status', 'bulletin_exclude', 'open_to_all',
    // added in Release 3 (18 November 2026): who sent it, while club_senders_only is watched or on
    'sender_check'],
  club_profile_requests: ['id', 'submitted_at', 'submitter_email', 'submitter_name', 'submitter_role', 'submitter_mobile',
    'club_id', 'club_name', 'website', 'facebook', 'instagram', 'youtube', 'x', 'linkedin', 'meeting_day_place', 'status',
    'approved_by', 'approved_at', 'moderator_note', 'is_sample', 'permanent_projects', 'regular_services', 'meeting_day',
    // added in Release 3 (18 November 2026): who sent it, while club_senders_only is watched or on
    'sender_check'],
  campaigns: ['campaign_id', 'rotary_year', 'name', 'slug', 'unit', 'start_date', 'end_date', 'target', 'description', 'chair',
    'chair_member_id', 'sort_order', 'is_sample'],
  magazines: ['issue_month', 'title', 'pdf_file', 'pdf_url', 'cover_image', 'is_sample'],
  messages: ['id', 'name', 'position', 'photo', 'message', 'date', 'featured', 'is_sample'],
  spotlights: ['month', 'public_key', 'member_name', 'headline', 'story', 'is_sample'],
  members_public: ['public_key', 'member_id', 'name', 'club_id', 'directory_ok', 'profession', 'area', 'description',
    'website', 'contact_ok', 'contact_link', 'photo_ok', 'photo_file', 'birthday_ok', 'birthday', 'spotlight_ok', 'is_sample',
    // added 23 November 2026: the Call button has its own choice and number (a wa.me link; the page makes the tel: link)
    'call_ok', 'call_link'],
  couples_public: ['couple_key', 'person_a_key', 'person_a_name', 'person_a_club_id', 'person_b_key', 'person_b_name',
    'person_b_club_id', 'anniversary', 'both_consented', 'couple_photo_file', 'is_sample'],
  // lasting facilities the public can use (blood banks, eye care, dialysis…), sent through the public service form
  public_services: ['id', 'submitted_at', 'submitter_email', 'submitter_name', 'submitter_role', 'submitter_mobile', 'club_id',
    'club_name', 'name', 'service_type', 'timings', 'phone', 'address', 'city', 'map_link', 'about', 'status', 'approved_by',
    'approved_at', 'moderator_note', 'notified', 'is_sample',
    // added in Release 3 (18 November 2026): who sent it, while club_senders_only is watched or on
    'sender_check'],
  // Rotary Means Business (17 November 2026): a member's own business and the topics they can speak on, sent through
  // the business form. member_id and member_name are filled from the private members list; only an approved row of
  // an active member is published, and never the member ID, the sender's mobile or email
  businesses: ['id', 'submitted_at', 'submitter_email', 'submitter_name', 'submitter_mobile', 'club_id', 'club_name', 'member_id',
    'member_name', 'business_name', 'trade', 'city', 'about', 'offer', 'website', 'whatsapp', 'photo_files', 'speaker_topics', 'status',
    'approved_by', 'approved_at', 'moderator_note', 'notified', 'is_sample'],
  // the About page: the RI President and the District Governor (role, year, name, theme, short profile, photo)
  profiles: ['role', 'rotary_year', 'name', 'theme', 'profile', 'photo', 'link', 'sort_order', 'is_sample'],
  // every Past District Governor, including those no longer with us (member_id only links a card; never shown)
  past_governors: ['rotary_year', 'name', 'club', 'member_id', 'is_sample'],
  dashboard: ['club_id', 'club_name', 'zone', 'member_count', 'last_activity_date', 'activities_this_month',
    'activities_last_month', 'activities_this_rotary_year', 'months_posted_this_rotary_year', 'needs_nudge'],
  role_checks: ['checked_at', 'tab', 'row', 'rotary_year', 'name', 'member_id', 'problem'],
  // who moderates, by type: one row per person and type; edit a row when someone changes (never sent to the website)
  // zone (Release 1): a Content moderator's zones (Agra, Bareilly, Kanpur); blank means every zone
  moderators: ['type', 'name', 'email', 'active', 'from_date', 'notes', 'sheet_access', 'zone'],
  // what moderators did on the moderation desk (filled in by the script; never sent to the website)
  moderator_log: ['at', 'moderator', 'action', 'tab', 'item', 'details'],
};

var SCHEMA_PRIVATE = {
  members_master: ['member_id', 'name', 'club_id', 'is_rotarian', 'status', 'mobile', 'email', 'dob', 'marriage_date',
    'spouse_id', 'directory_ok', 'contact_ok', 'photo_ok', 'birthday_ok', 'anniversary_ok', 'profession', 'area',
    'description', 'website', 'spotlight_ok', 'photo_file', 'photo_approved', 'listing_approved', 'listing_approved_by',
    'listing_approved_at', 'public_key', 'consent_source', 'consent_updated_at', 'notes', 'is_sample',
    // added 29 October 2026 with the real member list; private, never sent to the website
    'gender',
    // added 16 November 2026: when this year's July check email went to the member
    'member_check_sent_at',
    // added 23 November 2026 (My details split): kept by the district, never overwritten by an RI refresh. A second
    // email for a member whose RI email is old; the numbers for the Call and WhatsApp buttons (blank: the RI mobile);
    // separate consent for the profession lines and the Call button (blank: as directory_ok and contact_ok)
    'email2', 'call_number', 'whatsapp_number', 'profession_ok', 'call_ok'],
  club_history: ['member_id', 'club_id', 'from_date', 'to_date', 'reason', 'is_sample'],
  couples: ['couple_id', 'person_a_id', 'person_b_id', 'anniversary', 'a_consent', 'b_consent', 'couple_photo_ok_a',
    'couple_photo_ok_b', 'couple_photo_file', 'couple_photo_approved', 'status', 'notes', 'is_sample'],
  consent_requests: ['id', 'submitted_at', 'submitter_email', 'filled_by', 'club_id', 'name', 'member_id', 'mobile',
    'directory_ok', 'profession', 'area', 'description', 'website', 'spotlight_ok', 'contact_ok', 'photo_ok', 'photo_file',
    'birthday_ok', 'birthday', 'anniversary_ok', 'spouse_is_rotarian', 'spouse_name', 'spouse_club_id', 'spouse_member_id',
    'spouse_agrees', 'anniversary', 'couple_photo_file', 'couple_photo_spouse_agrees', 'declaration', 'status',
    'matched_member_id', 'approved_by', 'approved_at', 'moderator_note', 'is_sample',
    // added 1 November 2026: whether the member was told at their email on file
    'member_notice',
    // added 23 November 2026 (My details split): which form (show or update), the new consents and details
    'form', 'profession_ok', 'call_ok', 'couple_photo_ok', 'email2', 'call_number', 'whatsapp_number', 'remove_business'],
  // messages from the website's contact form; the reply details stay here and are never published
  contact_messages: ['id', 'submitted_at', 'name', 'reply_to', 'topic', 'city', 'message', 'status', 'forwarded_to', 'note', 'is_sample', 'replies'],
  removal_requests: ['id', 'submitted_at', 'submitter_email', 'club_id', 'name', 'member_id', 'mobile', 'remove_items',
    'reason', 'status', 'matched_member_id', 'approved_by', 'approved_at', 'moderator_note', 'is_sample',
    // added in Release 2 (18 November 2026): the My details form asks who is filling it
    'filled_by'],
  // club changes sent by anyone through the club changes form (17 November 2026): a member joined, left, moved or passed
  // away, or a club or district role. Nothing changes until a Members moderator approves; change is one of
  // joined, left, moved, deceased, club_role, district_role
  club_change_requests: ['id', 'submitted_at', 'submitter_email', 'club_id', 'change', 'member_id', 'name', 'date', 'new_club_id',
    'rotary_year', 'role', 'section', 'committee', 'note', 'status', 'approved_by', 'approved_at', 'moderator_note', 'is_sample',
    // added in Release 2 (18 November 2026): a new member's own mobile and email, for the members list only
    'mobile', 'email',
    // added in Release 3 (18 November 2026): who sent it, while club_senders_only is watched or on
    'sender_check'],
  // every change a moderator makes on the desk to a member, a role, a club or a moderator (Release 1, 18 November 2026):
  // one row per field, rows of one save share an id; Undo puts old_value back while the field still holds new_value
  change_log: ['id', 'at', 'moderator', 'action', 'tab', 'key', 'field', 'old_value', 'new_value', 'reason', 'undone_at', 'undone_by'],
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SCHEMA_MAIN: SCHEMA_MAIN, SCHEMA_PRIVATE: SCHEMA_PRIVATE };
}
