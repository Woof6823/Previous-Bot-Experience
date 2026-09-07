const { RegExpMatcher, englishDataset, englishRecommendedTransformers } = require("obscenity");






















const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers
});




const THREAT_PATTERNS = [
  /\bkys\b/i,
  /\bkill\s?your ?self\b/i,
  /\b(i'?ll|i will|gonna) (kill|hurt|beat|find) (you|u)\b/i,
  /\bi know where you live\b/i,
  /\bi'?m going to (kill|hurt) you\b/i
];



const TARGETING_RE = /\b(you'?re|ur|you|u)\b/i;

// ---------------------------------------------------------------------
// INSTANT-BAN SLUR CHECK
// ---------------------------------------------------------------------
// A specific racial slur (and its common variants/leetspeak) always
// escalates straight to an instant ban, separate from and above the
// SAFE/MILD/TOXIC/SEVERE tiers above. obscenity's own dataset already








const SLUR_ORIGINAL_WORDS = new Set(["nigger"]);
const SLUR_SUPPLEMENTARY_RE = /\bnga\b/i;

function containsInstantBanSlur(text) {
  if (SLUR_SUPPLEMENTARY_RE.test(text)) return true;
  const matches = matcher.getAllMatches(text);
  return matches.some((m) => {
    const meta = englishDataset.getPayloadWithPhraseMetadata(m);
    return SLUR_ORIGINAL_WORDS.has(meta.phraseMetadata?.originalWord);
  });
}

function classifyOffensive(content) {
  const text = content.trim();
  if (!text) return { severity: "SAFE", confidence: 1, matchCount: 0 };

  if (containsInstantBanSlur(text)) {
    return { severity: "INSTANT_BAN", confidence: 0.99, matchCount: 1, reason: "slur" };
  }

  if (THREAT_PATTERNS.some((re) => re.test(text))) {
    return { severity: "SEVERE", confidence: 0.95, matchCount: 1, reason: "threat" };
  }

  const rawMatches = matcher.getAllMatches(text);
  if (rawMatches.length === 0) {
    return { severity: "SAFE", confidence: 0.9, matchCount: 0 };
  }







  const distinctSpans = new Set(rawMatches.map((m) => `${m.startIndex}-${m.endIndex}`));
  const matchCount = distinctSpans.size;

  const targeted = TARGETING_RE.test(text);

  if (matchCount >= 3 || (matchCount >= 2 && targeted)) {
    return { severity: "SEVERE", confidence: 0.85, matchCount, reason: "repeated_targeted" };
  }

  if (targeted || matchCount >= 2) {
    return { severity: "TOXIC", confidence: 0.8, matchCount, reason: "targeted_or_repeated" };
  }

  return { severity: "MILD", confidence: 0.75, matchCount, reason: "single_untargeted" };
}

module.exports = { classifyOffensive };
