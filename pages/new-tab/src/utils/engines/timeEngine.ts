export interface TimeResult {
  location: string;
  time: string;
  timezone: string;
}

// ------------------ TIMEZONE DATABASE ------------------

// Major US timezones
const USA_TIMEZONES: Record<string, string> = {
  eastern: 'America/New_York',
  central: 'America/Chicago',
  mountain: 'America/Denver',
  pacific: 'America/Los_Angeles',
};

// US States → Timezone
const USA_STATES: Record<string, string> = {
  'new york': 'America/New_York',
  california: 'America/Los_Angeles',
  texas: 'America/Chicago',
  florida: 'America/New_York',
  illinois: 'America/Chicago',
  colorado: 'America/Denver',
};

// Major Global Cities -> Timezone
const CITIES: Record<string, string> = {
  london: 'Europe/London',
  paris: 'Europe/Paris',
  berlin: 'Europe/Berlin',
  rome: 'Europe/Rome',
  madrid: 'Europe/Madrid',
  moscow: 'Europe/Moscow',
  dubai: 'Asia/Dubai',
  tokyo: 'Asia/Tokyo',
  beijing: 'Asia/Shanghai',
  shanghai: 'Asia/Shanghai',
  'hong kong': 'Asia/Hong_Kong',
  singapore: 'Asia/Singapore',
  seoul: 'Asia/Seoul',
  mumbai: 'Asia/Kolkata',
  delhi: 'Asia/Kolkata',
  bangkok: 'Asia/Bangkok',
  jakarta: 'Asia/Jakarta',
  sydney: 'Australia/Sydney',
  melbourne: 'Australia/Melbourne',
  auckland: 'Pacific/Auckland',
  cairo: 'Africa/Cairo',
  johannesburg: 'Africa/Johannesburg',
  lagos: 'Africa/Lagos',
  nairobi: 'Africa/Nairobi',
  'sao paulo': 'America/Sao_Paulo',
  'buenos aires': 'America/Argentina/Buenos_Aires',
  santiago: 'America/Santiago',
  'mexico city': 'America/Mexico_City',
  toronto: 'America/Toronto',
  vancouver: 'America/Vancouver',
  'new york': 'America/New_York',
  'los angeles': 'America/Los_Angeles',
  chicago: 'America/Chicago',
  houston: 'America/Chicago',
  miami: 'America/New_York',
  seattle: 'America/Los_Angeles',
};

// Countries → Primary Timezone
const COUNTRIES: Record<string, string | null> = {
  usa: null, // special handling
  'united states': null,
  india: 'Asia/Kolkata',
  uk: 'Europe/London',
  'united kingdom': 'Europe/London',
  japan: 'Asia/Tokyo',
  australia: 'Australia/Sydney',
  canada: 'America/Toronto',
  singapore: 'Asia/Singapore',
  'south africa': 'Africa/Johannesburg',
  egypt: 'Africa/Cairo',
  nigeria: 'Africa/Lagos',
  kenya: 'Africa/Nairobi',
  france: 'Europe/Paris',
  germany: 'Europe/Berlin',
  italy: 'Europe/Rome',
  spain: 'Europe/Madrid',
  russia: 'Europe/Moscow',
  uae: 'Asia/Dubai',
  'united arab emirates': 'Asia/Dubai',
  china: 'Asia/Shanghai',
  'south korea': 'Asia/Seoul',
  brazil: 'America/Sao_Paulo',
  argentina: 'America/Argentina/Buenos_Aires',
  mexico: 'America/Mexico_City',
  indonesia: 'Asia/Jakarta',
  thailand: 'Asia/Bangkok',
  turkey: 'Europe/Istanbul',
  'saudi arabia': 'Asia/Riyadh',
  philippines: 'Asia/Manila',
  malaysia: 'Asia/Kuala_Lumpur',
  vietnam: 'Asia/Ho_Chi_Minh',
  pakistan: 'Asia/Karachi',
  bangladesh: 'Asia/Dhaka',
  'new zealand': 'Pacific/Auckland',
};

// Safe exact token abbreviations
// Safe exact token abbreviations -> { tz: string | null, label: string }
const ABBREVIATIONS: Record<string, { tz: string | null; label: string }> = {
  us: { tz: null, label: 'USA' },
  ind: { tz: 'Asia/Kolkata', label: 'India' },
  in: { tz: 'Asia/Kolkata', label: 'India' },
  jpnd: { tz: 'Asia/Tokyo', label: 'Japan' },
  jp: { tz: 'Asia/Tokyo', label: 'Japan' },
  aus: { tz: 'Australia/Sydney', label: 'Australia' },
  can: { tz: 'America/Toronto', label: 'Canada' },
  sg: { tz: 'Asia/Singapore', label: 'Singapore' },
  za: { tz: 'Africa/Johannesburg', label: 'South Africa' },
  eg: { tz: 'Africa/Cairo', label: 'Egypt' },
  ng: { tz: 'Africa/Lagos', label: 'Nigeria' },
  ke: { tz: 'Africa/Nairobi', label: 'Kenya' },
  fr: { tz: 'Europe/Paris', label: 'France' },
  ger: { tz: 'Europe/Berlin', label: 'Germany' },
  de: { tz: 'Europe/Berlin', label: 'Germany' },
  it: { tz: 'Europe/Rome', label: 'Italy' },
  es: { tz: 'Europe/Madrid', label: 'Spain' },
  ru: { tz: 'Europe/Moscow', label: 'Russia' },
  cn: { tz: 'Asia/Shanghai', label: 'China' },
  kr: { tz: 'Asia/Seoul', label: 'South Korea' },
  br: { tz: 'America/Sao_Paulo', label: 'Brazil' },
  ar: { tz: 'America/Argentina/Buenos_Aires', label: 'Argentina' },
  mx: { tz: 'America/Mexico_City', label: 'Mexico' },
  id: { tz: 'Asia/Jakarta', label: 'Indonesia' },
  th: { tz: 'Asia/Bangkok', label: 'Thailand' },
  tr: { tz: 'Europe/Istanbul', label: 'Turkey' },
  sa: { tz: 'Asia/Riyadh', label: 'Saudi Arabia' },
  ph: { tz: 'Asia/Manila', label: 'Philippines' },
  my: { tz: 'Asia/Kuala_Lumpur', label: 'Malaysia' },
  vn: { tz: 'Asia/Ho_Chi_Minh', label: 'Vietnam' },
  pk: { tz: 'Asia/Karachi', label: 'Pakistan' },
  bd: { tz: 'Asia/Dhaka', label: 'Bangladesh' },
  nz: { tz: 'Pacific/Auckland', label: 'New Zealand' },
};

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isTimeQuery(query: string) {
  const lower = query.toLowerCase();
  return lower.includes('time') || lower.includes('current time') || lower.includes('what time');
}

function containsWord(text: string, word: string) {
  const safeWord = escapeRegex(word);
  return new RegExp(`\\b${safeWord}\\b`, 'i').test(text);
}

export function getFormattedTime(timezone: string) {
  return new Date().toLocaleString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
}

function normalize(str: string): string {
  return str.replace(/_/g, ' ').toLowerCase();
}

function capitalizeLocation(loc: string): string {
  const lower = loc.toLowerCase();
  if (lower === 'usa') return 'USA';
  if (lower === 'uk') return 'UK';
  if (lower === 'uae') return 'UAE';

  return loc
    .split(' ')
    .map(word => {
      if (!word) return '';
      if (word.startsWith('(') && word.endsWith(')')) {
        const inner = word.slice(1, -1);
        return '(' + inner.charAt(0).toUpperCase() + inner.slice(1).toLowerCase() + ')';
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function extractSearchTerm(query: string): string {
  const lower = query.toLowerCase();
  // Remove trigger words to isolate the location
  let term = lower;
  const triggers = ['what time is it in', 'current time in', 'time in', 'time at', 'what time', 'current time', 'time'];
  for (const trigger of triggers) {
    if (term.includes(trigger)) {
      term = term.replace(trigger, '').trim();
      break; // Only replace the longest matching trigger once
    }
  }
  // Also clean up any leading/trailing prepositions or punctuation
  term = term.replace(/^(is|in|at|for|the)\s+/i, '').trim();
  term = term.replace(/[?]+$/, '').trim();
  return term;
}

export function processTimeQuery(query: string): TimeResult[] | null {
  const lower = query.toLowerCase();

  if (!isTimeQuery(query)) return null;

  const rawSearchTerm = extractSearchTerm(query);

  // If no specific term was extracted (e.g. they just typed "time"), we can either
  // return nothing or a default. Let's return nothing so normal search takes over.
  if (!rawSearchTerm || rawSearchTerm.length < 2) {
    // 4️⃣ If USA mentioned as a whole string -> return ALL US zones
    if (containsWord(lower, 'usa') || containsWord(lower, 'united states')) {
      return Object.entries(USA_TIMEZONES).map(([region, tz]) => ({
        location: `USA (${region.charAt(0).toUpperCase() + region.slice(1).toLowerCase()})`,
        time: getFormattedTime(tz),
        timezone: tz,
      }));
    }
    return null;
  }

  const results: TimeResult[] = [];
  const addedLocations = new Set<string>();

  const addResult = (locationName: string, tz: string | null) => {
    // usa/united states resolving to null means we add all US zones
    if (!tz && (locationName.toLowerCase() === 'usa' || locationName.toLowerCase() === 'united states')) {
      Object.entries(USA_TIMEZONES).forEach(([region, usTz]) => {
        const loc = `USA (${region.charAt(0).toUpperCase() + region.slice(1).toLowerCase()})`;
        if (!addedLocations.has(loc)) {
          results.push({
            location: loc,
            time: getFormattedTime(usTz),
            timezone: usTz,
          });
          addedLocations.add(loc);
        }
      });
      return;
    }

    const displayLabel = capitalizeLocation(locationName);
    if (tz && !addedLocations.has(displayLabel)) {
      results.push({
        location: displayLabel,
        time: getFormattedTime(tz),
        timezone: tz,
      });
      addedLocations.add(displayLabel);
    }
  };

  // NEW: Handle cases like "usaeastern" or "usa eastern"
  let regionSearchTerm = rawSearchTerm;
  if (rawSearchTerm.startsWith('usa') && rawSearchTerm.length > 3) {
    regionSearchTerm = rawSearchTerm.slice(3).trim();
  } else if (rawSearchTerm.startsWith('united states') && rawSearchTerm.length > 13) {
    regionSearchTerm = rawSearchTerm.slice(13).trim();
  }

  // 1️⃣ Check Cities (Prefix match)
  for (const city in CITIES) {
    const normalizedCity = normalize(city);
    if (
      (regionSearchTerm.length >= 2 && normalizedCity.startsWith(regionSearchTerm)) ||
      containsWord(lower, normalizedCity) ||
      normalizedCity === regionSearchTerm
    ) {
      addResult(city, CITIES[city]);
    }
  }

  // 2️⃣ Check US States (Prefix match)
  for (const state in USA_STATES) {
    if (
      (regionSearchTerm.length >= 2 && state.startsWith(regionSearchTerm)) ||
      containsWord(lower, state) ||
      state === regionSearchTerm
    ) {
      addResult(state, USA_STATES[state]);
    }
  }

  // 2.5 Check US Timezone Regions (Prefix match or word match)
  for (const region in USA_TIMEZONES) {
    const words = regionSearchTerm.split(/[\s-]+/);
    const matchesRegion = words.some(w => w.length >= 3 && region.startsWith(w.toLowerCase()));
    if (
      (regionSearchTerm.length >= 3 && region.startsWith(regionSearchTerm)) ||
      containsWord(lower, region) ||
      matchesRegion
    ) {
      addResult(`USA (${region.charAt(0).toUpperCase() + region.slice(1).toLowerCase()})`, USA_TIMEZONES[region]);
    }
  }

  // 3️⃣ Check Countries (Prefix match)
  for (const country in COUNTRIES) {
    const isExactMatch = country === rawSearchTerm;
    const isPrefixMatch = country.startsWith(rawSearchTerm);

    // If it's a multi-timezone country (tz is null), only add ALL if it's an exact match
    // or if no other results were found yet. This prevents "usa" from matching in "usa eastern"
    // and pulling in all US zones.
    if (isExactMatch || (isPrefixMatch && results.length === 0)) {
      addResult(country, COUNTRIES[country]);
    }
  }

  // 4️⃣ Check Exact Safe Abbreviations
  if (rawSearchTerm in ABBREVIATIONS) {
    const abbr = ABBREVIATIONS[rawSearchTerm];
    addResult(abbr.label, abbr.tz);
  }

  if (results.length > 0) {
    // Exact match sorting
    results.sort((a, b) => {
      const aLower = a.location.toLowerCase();
      const bLower = b.location.toLowerCase();
      if (aLower === rawSearchTerm) return -1;
      if (bLower === rawSearchTerm) return 1;
      return 0;
    });

    // Limit to 5 results to avoid overwhelming the suggestions list for short prefixes
    return results.slice(0, 5);
  }

  // Fallback for full string match "usa" just in case it was missed
  if (containsWord(lower, 'usa') || containsWord(lower, 'united states')) {
    const isJustUsa = lower.includes('time at usa') || lower.includes('usa time') || lower.trim() === 'usa';
    if (isJustUsa) {
      return Object.entries(USA_TIMEZONES).map(([region, tz]) => ({
        location: `USA (${region.charAt(0).toUpperCase() + region.slice(1).toLowerCase()})`,
        time: getFormattedTime(tz),
        timezone: tz,
      }));
    }
  }

  return null;
}
