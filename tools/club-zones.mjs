// City and zone for each club, worked out from the club's name.
// Zones follow the "Co Chairman - <Zone> Zone" labels in the district Excel.
// This list should be checked once by the district (see docs/3110-Website-Excel-Data-Conversion-Report.md).

export const ZONES = ['Agra', 'Bareilly', 'Kanpur'];

// keyword in club name -> [city, zone]; first match wins, so specific names come first
const CITY_RULES = [
  ['Izatnagar', 'Bareilly', 'Bareilly'],
  ['Brahmavarta', 'Kanpur', 'Kanpur'],
  ['Ganga Ghat', 'Gangaghat', 'Kanpur'],
  ['Puranpur', 'Puranpur', 'Bareilly'],
  ['Kashipur', 'Kashipur', 'Bareilly'],
  ['Agra', 'Agra', 'Agra'],
  ['Aligarh', 'Aligarh', 'Agra'],
  ['Mathura', 'Mathura', 'Agra'],
  ['Hathras', 'Hathras', 'Agra'],
  ['Firozabad', 'Firozabad', 'Agra'],
  ['Shikohabad', 'Shikohabad', 'Agra'],
  ['Kasganj', 'Kasganj', 'Agra'],
  ['Bareilly', 'Bareilly', 'Bareilly'],
  ['Budaun', 'Budaun', 'Bareilly'],
  ['Bisauli', 'Bisauli', 'Bareilly'],
  ['Pilibhit', 'Pilibhit', 'Bareilly'],
  ['Rampur', 'Rampur', 'Bareilly'],
  ['Rudrapur', 'Rudrapur', 'Bareilly'],
  ['Haldwani', 'Haldwani', 'Bareilly'],
  ['Nainital', 'Nainital', 'Bareilly'],
  ['Kanpur', 'Kanpur', 'Kanpur'],
  ['Jhansi', 'Jhansi', 'Kanpur'],
  ['Unnao', 'Unnao', 'Kanpur'],
];

export function cityAndZone(clubName) {
  for (const [keyword, city, zone] of CITY_RULES) {
    if (clubName.includes(keyword)) return { city, zone };
  }
  return { city: '', zone: '' };
}
