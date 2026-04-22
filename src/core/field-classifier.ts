import type { CandidateFieldType, FieldSignature, FieldType } from './types';
import { includesAny, normalizeText, uniqueStrings } from './utils';

interface Rule {
  fieldType: FieldType;
  weight: number;
  reason: string;
  test: (ctx: string, signature: FieldSignature) => boolean;
}

const RULES: Rule[] = [
  { fieldType: 'email', weight: 0.65, reason: 'input type=email', test: (_ctx, s) => normalizeText(s.inputType) === 'email' },
  { fieldType: 'email', weight: 0.6, reason: 'autocomplete=email', test: (_ctx, s) => normalizeText(s.autocomplete) === 'email' },
  { fieldType: 'first_name', weight: 0.85, reason: 'mentions first name', test: (ctx) => includesAny(ctx, ['first name', 'given name', 'forename']) },
  { fieldType: 'last_name', weight: 0.85, reason: 'mentions last name', test: (ctx) => includesAny(ctx, ['last name', 'family name', 'surname']) },
  { fieldType: 'full_name', weight: 0.78, reason: 'mentions full name', test: (ctx) => includesAny(ctx, ['full name', 'your name', 'name']) },
  { fieldType: 'email', weight: 0.82, reason: 'mentions email', test: (ctx) => includesAny(ctx, ['email', 'e-mail']) },
  { fieldType: 'phone', weight: 0.82, reason: 'mentions phone', test: (ctx) => includesAny(ctx, ['phone', 'mobile', 'telephone', 'contact number']) },
  { fieldType: 'location_city', weight: 0.72, reason: 'mentions city', test: (ctx) => includesAny(ctx, ['city', 'town']) },
  { fieldType: 'location_full', weight: 0.8, reason: 'mentions location', test: (ctx) => includesAny(ctx, ['location', 'address', 'where are you based']) },
  { fieldType: 'linkedin_url', weight: 0.9, reason: 'mentions linkedin', test: (ctx) => includesAny(ctx, ['linkedin']) },
  { fieldType: 'github_url', weight: 0.9, reason: 'mentions github', test: (ctx) => includesAny(ctx, ['github']) },
  { fieldType: 'portfolio_url', weight: 0.9, reason: 'mentions portfolio', test: (ctx) => includesAny(ctx, ['portfolio']) },
  { fieldType: 'website_url', weight: 0.74, reason: 'mentions website', test: (ctx) => includesAny(ctx, ['website', 'personal site']) },
  { fieldType: 'current_title', weight: 0.78, reason: 'mentions title/role', test: (ctx) => includesAny(ctx, ['job title', 'current title', 'title', 'role', 'position']) },
  { fieldType: 'current_company', weight: 0.82, reason: 'mentions company/employer', test: (ctx) => includesAny(ctx, ['company', 'employer', 'current company']) },
  { fieldType: 'work_authorization', weight: 0.92, reason: 'mentions work authorization', test: (ctx) => includesAny(ctx, ['work authorization', 'authorized to work', 'legally authorized']) },
  { fieldType: 'visa_sponsorship_required', weight: 0.92, reason: 'mentions visa sponsorship', test: (ctx) => includesAny(ctx, ['visa sponsorship', 'require sponsorship', 'sponsorship']) },
  { fieldType: 'notice_period', weight: 0.88, reason: 'mentions notice period', test: (ctx) => includesAny(ctx, ['notice period']) },
  { fieldType: 'years_experience_total', weight: 0.88, reason: 'mentions years of experience', test: (ctx) => includesAny(ctx, ['years of experience', 'total experience', 'experience in years']) }
];

const autocompleteBoosts: Partial<Record<string, FieldType>> = {
  'given-name': 'first_name',
  'family-name': 'last_name',
  name: 'full_name',
  tel: 'phone',
  url: 'website_url'
};

export function classifyField(signature: FieldSignature): CandidateFieldType[] {
  const rawPieces = uniqueStrings([
    signature.label,
    signature.name,
    signature.id,
    signature.placeholder,
    signature.autocomplete,
    signature.ariaLabel,
    ...(signature.nearbyText ?? [])
  ]);

  const ctx = normalizeText(rawPieces.join(' | '));
  const scores = new Map<FieldType, { score: number; reasons: string[] }>();

  for (const rule of RULES) {
    if (!rule.test(ctx, signature)) continue;
    const existing = scores.get(rule.fieldType) ?? { score: 0, reasons: [] };
    existing.score += rule.weight;
    existing.reasons.push(rule.reason);
    scores.set(rule.fieldType, existing);
  }

  const autocompleteMatch = autocompleteBoosts[normalizeText(signature.autocomplete)];
  if (autocompleteMatch) {
    const existing = scores.get(autocompleteMatch) ?? { score: 0, reasons: [] };
    existing.score += 0.8;
    existing.reasons.push(`autocomplete=${signature.autocomplete}`);
    scores.set(autocompleteMatch, existing);
  }

  if (normalizeText(signature.inputType) === 'url') {
    ['linkedin_url', 'portfolio_url', 'website_url', 'github_url'].forEach((fieldType) => {
      const existing = scores.get(fieldType as FieldType) ?? { score: 0, reasons: [] };
      existing.score += 0.15;
      existing.reasons.push('input type=url');
      scores.set(fieldType as FieldType, existing);
    });
  }

  const candidates: CandidateFieldType[] = Array.from(scores.entries())
    .map(([fieldType, value]) => ({
      fieldType,
      score: Math.min(1, Number(value.score.toFixed(2))),
      reason: value.reasons
    }))
    .sort((a, b) => b.score - a.score);

  return candidates.length > 0 ? candidates : [{ fieldType: 'unknown', score: 0.1, reason: ['no confident heuristic matched'] }];
}
