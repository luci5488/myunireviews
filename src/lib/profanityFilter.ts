const BLOCKED_WORDS = [
  'fuck', 'fucker', 'fucking', 'fucked', 'fucks',
  'shit', 'shits', 'shitty', 'bullshit',
  'ass', 'asshole', 'arsehole', 'arse',
  'bitch', 'bitches', 'bitchy',
  'bastard', 'bastards',
  'cunt', 'cunts',
  'dick', 'dicks', 'dickhead',
  'cock', 'cocks',
  'pussy', 'pussies',
  'prick', 'pricks',
  'twat', 'twats',
  'whore', 'whores',
  'slut', 'sluts',
  'nigger', 'nigga',
  'faggot', 'fag',
  'retard', 'retarded',
  'idiot', 'moron', 'stupid',
  'crap', 'damn', 'hell',
  'piss', 'pissed',
  'wanker', 'wank',
];

const pattern = new RegExp(
  `\\b(${BLOCKED_WORDS.join('|')})\\b`,
  'i'
);

export function containsProfanity(text: string): boolean {
  return pattern.test(text);
}

export function cleanProfanity(text: string): string {
  return text.replace(new RegExp(`\\b(${BLOCKED_WORDS.join('|')})\\b`, 'gi'), (match) =>
    '*'.repeat(match.length)
  );
}
