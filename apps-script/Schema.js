/**
 * Tabs and columns of the two spreadsheets. Shared by the Sheet script and the
 * website's sample-data generator, so both always agree on the layout.
 */

var SCHEMA_MAIN = {
  settings: ['key', 'value', 'notes'],
  lists: ['list', 'value'],
  clubs: ['club_id', 'club_name', 'display_name', 'slug', 'former_names', 'city', 'zone', 'status', 'member_count',
    'meeting_day_place', 'website', 'facebook', 'instagram', 'youtube', 'x', 'linkedin', 'profile_updated_at', 'is_sample'],
  officers: ['rotary_year', 'club_id', 'member_id', 'name', 'role', 'contact_ok', 'contact_link', 'is_sample'],
  functionaries: ['rotary_year', 'page', 'section', 'committee', 'member_id', 'name', 'role', 'zone', 'club_id', 'term',
    'sort_order', 'contact_ok', 'contact_link', 'is_sample'],
  activities: ['id', 'submitted_at', 'submitter_email', 'submitter_name', 'submitter_role', 'submitter_mobile', 'club_id',
    'club_name', 'title', 'date', 'theme', 'description', 'photo_files', 'post_link', 'people_helped', 'amount_spent', 'partner_clubs',
    'photo_consent', 'status', 'source', 'approved_by', 'approved_at', 'moderator_note', 'story_of_month', 'event_id',
    'notified', 'is_sample'],
  events: ['id', 'submitted_at', 'submitter_email', 'submitter_name', 'submitter_role', 'submitter_mobile', 'title',
    'event_type', 'start_date', 'start_time', 'end_date', 'venue', 'city', 'organiser', 'description', 'map_link',
    'details_link', 'photo_files', 'status', 'source', 'approved_by', 'approved_at', 'moderator_note', 'report_activity_id', 'notified',
    'is_sample'],
  club_profile_requests: ['id', 'submitted_at', 'submitter_email', 'submitter_name', 'submitter_role', 'submitter_mobile',
    'club_id', 'club_name', 'website', 'facebook', 'instagram', 'youtube', 'x', 'linkedin', 'meeting_day_place', 'status',
    'approved_by', 'approved_at', 'moderator_note', 'is_sample'],
  magazines: ['issue_month', 'title', 'pdf_file', 'pdf_url', 'cover_image', 'is_sample'],
  messages: ['id', 'name', 'position', 'photo', 'message', 'date', 'featured', 'is_sample'],
  spotlights: ['month', 'public_key', 'member_name', 'headline', 'story', 'is_sample'],
  members_public: ['public_key', 'member_id', 'name', 'club_id', 'directory_ok', 'profession', 'area', 'description',
    'website', 'contact_ok', 'contact_link', 'photo_ok', 'photo_file', 'birthday_ok', 'birthday', 'spotlight_ok', 'is_sample'],
  couples_public: ['couple_key', 'person_a_key', 'person_a_name', 'person_a_club_id', 'person_b_key', 'person_b_name',
    'person_b_club_id', 'anniversary', 'both_consented', 'couple_photo_file', 'is_sample'],
  dashboard: ['club_id', 'club_name', 'zone', 'member_count', 'last_activity_date', 'activities_this_month',
    'activities_last_month', 'activities_this_rotary_year', 'months_posted_this_rotary_year', 'needs_nudge'],
};

var SCHEMA_PRIVATE = {
  members_master: ['member_id', 'name', 'club_id', 'is_rotarian', 'status', 'mobile', 'email', 'dob', 'marriage_date',
    'spouse_id', 'directory_ok', 'contact_ok', 'photo_ok', 'birthday_ok', 'anniversary_ok', 'profession', 'area',
    'description', 'website', 'spotlight_ok', 'photo_file', 'photo_approved', 'listing_approved', 'listing_approved_by',
    'listing_approved_at', 'public_key', 'consent_source', 'consent_updated_at', 'notes', 'is_sample'],
  club_history: ['member_id', 'club_id', 'from_date', 'to_date', 'reason', 'is_sample'],
  couples: ['couple_id', 'person_a_id', 'person_b_id', 'anniversary', 'a_consent', 'b_consent', 'couple_photo_ok_a',
    'couple_photo_ok_b', 'couple_photo_file', 'couple_photo_approved', 'status', 'notes', 'is_sample'],
  consent_requests: ['id', 'submitted_at', 'submitter_email', 'filled_by', 'club_id', 'name', 'member_id', 'mobile',
    'directory_ok', 'profession', 'area', 'description', 'website', 'spotlight_ok', 'contact_ok', 'photo_ok', 'photo_file',
    'birthday_ok', 'birthday', 'anniversary_ok', 'spouse_is_rotarian', 'spouse_name', 'spouse_club_id', 'spouse_member_id',
    'spouse_agrees', 'anniversary', 'couple_photo_file', 'couple_photo_spouse_agrees', 'declaration', 'status',
    'matched_member_id', 'approved_by', 'approved_at', 'moderator_note', 'is_sample'],
  removal_requests: ['id', 'submitted_at', 'submitter_email', 'club_id', 'name', 'member_id', 'mobile', 'remove_items',
    'reason', 'status', 'matched_member_id', 'approved_by', 'approved_at', 'moderator_note', 'is_sample'],
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SCHEMA_MAIN: SCHEMA_MAIN, SCHEMA_PRIVATE: SCHEMA_PRIVATE };
}
