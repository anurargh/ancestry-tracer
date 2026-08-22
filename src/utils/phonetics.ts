/**
 * Phonetics and String Similarity Utilities for Duplicate Detection
 */

/**
 * Standard American Soundex algorithm
 * Encodes a surname phonetically into a 4-character code (Letter + 3 digits)
 * e.g., "Smith" -> "S530", "Smythe" -> "S530", "Jackson" -> "J250"
 */
export function soundex(str: string): string {
  if (!str) return '0000';
  const clean = str.toUpperCase().replace(/[^A-Z]/g, '');
  if (!clean.length) return '0000';

  const firstLetter = clean[0];

  const map: Record<string, string> = {
    B: '1', F: '1', P: '1', V: '1',
    C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
    D: '3', T: '3',
    L: '4',
    M: '5', N: '5',
    R: '6',
  };

  let codes = firstLetter;
  let prevCode = map[firstLetter] || '0';

  for (let i = 1; i < clean.length; i++) {
    const char = clean[i];
    const code = map[char] || '0';

    // Vowels and H/W act as separators; if not '0' and not same as previous
    if (code !== '0') {
      if (code !== prevCode) {
        codes += code;
      }
    }
    prevCode = code;

    if (codes.length === 4) break;
  }

  // Pad with zeroes to exactly 4 chars
  return (codes + '0000').slice(0, 4);
}

/**
 * Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();

  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[s2.length][s1.length];
}

/**
 * Normalized string similarity ratio between 0.0 and 1.0
 */
export function stringSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();

  if (s1 === s2) return 1.0;
  if (!s1.length || !s2.length) return 0.0;

  const maxLen = Math.max(s1.length, s2.length);
  const dist = levenshteinDistance(s1, s2);
  return Math.max(0, 1.0 - dist / maxLen);
}

/**
 * Extract surname and given names from a full name string
 */
export function parseFullName(fullName: string): { given: string; surname: string } {
  if (!fullName) return { given: '', surname: '' };
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { given: '', surname: '' };
  if (tokens.length === 1) return { given: tokens[0], surname: tokens[0] };

  const surname = tokens[tokens.length - 1];
  const given = tokens.slice(0, -1).join(' ');
  return { given, surname };
}

/**
 * Extract 4-digit year and birth decade from a date string
 */
export function extractBirthDecade(dateStr: string): { year: number | null; decade: number | null; decadeKey: string } {
  if (!dateStr) return { year: null, decade: null, decadeKey: 'unknown' };

  // Match 4-digit year
  const match = dateStr.match(/\b(1\d{3}|20\d{2})\b/);
  if (match) {
    const year = parseInt(match[1], 10);
    const decade = Math.floor(year / 10) * 10;
    return { year, decade, decadeKey: `${decade}s` };
  }

  return { year: null, decade: null, decadeKey: 'unknown' };
}
