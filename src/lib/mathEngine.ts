import { create, all } from 'mathjs';

export type AngleUnit = 'DEG' | 'RAD' | 'GRAD';

const math = create(all, {
  number: 'number',
  precision: 14,
});

function toRadians(val: number, unit: AngleUnit): number {
  if (unit === 'DEG') return (val * Math.PI) / 180;
  if (unit === 'GRAD') return (val * Math.PI) / 200;
  return val;
}

function fromRadians(val: number, unit: AngleUnit): number {
  if (unit === 'DEG') return (val * 180) / Math.PI;
  if (unit === 'GRAD') return (val * 200) / Math.PI;
  return val;
}

function buildScope(angleUnit: AngleUnit, ans: number, extra: Record<string, number> = {}) {
  return {
    pi: Math.PI,
    π: Math.PI,
    e: Math.E,
    phi: (1 + Math.sqrt(5)) / 2,
    φ: (1 + Math.sqrt(5)) / 2,
    c: 299792458,
    h: 6.62607015e-34,
    G: 6.6743e-11,
    ANS: ans,
    ans: ans,
    sin: (x: number) => Math.sin(toRadians(x, angleUnit)),
    cos: (x: number) => Math.cos(toRadians(x, angleUnit)),
    tan: (x: number) => {
      const rad = toRadians(x, angleUnit);
      if (Math.abs(Math.cos(rad)) < 1e-15) return Number.POSITIVE_INFINITY;
      return Math.tan(rad);
    },
    asin: (x: number) => fromRadians(Math.asin(x), angleUnit),
    acos: (x: number) => fromRadians(Math.acos(x), angleUnit),
    atan: (x: number) => fromRadians(Math.atan(x), angleUnit),
    csc: (x: number) => 1 / Math.sin(toRadians(x, angleUnit)),
    sec: (x: number) => 1 / Math.cos(toRadians(x, angleUnit)),
    cot: (x: number) => 1 / Math.tan(toRadians(x, angleUnit)),
    ln: (x: number) => Math.log(x),
    log: (x: number, base?: number) => (base !== undefined ? Math.log(x) / Math.log(base) : Math.log10(x)),
    log10: (x: number) => Math.log10(x),
    log2: (x: number) => Math.log2(x),
    nPr: (n: number, r: number) => math.permutations(n, r) as number,
    nCr: (n: number, r: number) => math.combinations(n, r) as number,
    ...extra,
  };
}

export function normalizeExpression(raw: string): string {
  let expr = raw
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/π/g, 'pi')
    .replace(/√\s*(\d+(?:\.\d+)?)/g, 'sqrt($1)')
    .replace(/√\(/g, 'sqrt(')
    .replace(/∛\s*(\d+(?:\.\d+)?)/g, 'cbrt($1)')
    .replace(/∛\(/g, 'cbrt(')
    .trim();

  // Standard calculator percentage: "A + B%" -> "A + (A * B / 100)" and "A - B%" -> "A - (A * B / 100)"
  const addSubPctMatch = expr.match(/^(.+?)\s*([+-])\s*(\d+(?:\.\d+)?)%(?!\s*\d)$/);
  if (addSubPctMatch) {
    const base = addSubPctMatch[1].trim();
    const op = addSubPctMatch[2];
    const pct = addSubPctMatch[3];
    if (base && !/[*/^(]$/.test(base)) {
      expr = `(${base}) ${op} ((${base}) * (${pct} / 100))`;
    }
  }

  // Remaining percentages like "50%" or "200 * 10%" -> "(50 * 0.01)" (preserve modulo if digit follows %)
  expr = expr.replace(/(\d+(?:\.\d+)?|\))%(?!\s*[\d(])/g, '($1*0.01)');

  // Implicit multiplication while preserving scientific notation (e.g. 1e5, 1.5e-3, 2e+4)
  expr = expr
    .replace(/(\d)(?!(?:e|E)[+-]?\d)([a-zA-Z(])/g, '$1*$2')
    .replace(/\)(\d|\()/g, ')*$1')
    .trim();

  return expr;
}

export interface EvalResult {
  ok: boolean;
  value?: number;
  formatted?: string;
  error?: string;
}

export function formatSciNumber(num: number, forceScientific = false): string {
  if (Number.isNaN(num)) return 'NaN';
  if (!Number.isFinite(num)) return num > 0 ? '∞' : '-∞';
  if (Object.is(num, -0) || num === 0) return '0';

  const abs = Math.abs(num);
  if (forceScientific || (abs !== 0 && (abs >= 1e12 || abs < 1e-7))) {
    const exp = num.toExponential(8).replace(/\.?0+e/, 'e');
    return exp;
  }

  const rounded = Number(num.toPrecision(12));
  return String(rounded);
}

export function evaluateExpression(
  rawExpression: string,
  angleUnit: AngleUnit,
  ans = 0,
  forceScientific = false
): EvalResult {
  const cleaned = normalizeExpression(rawExpression);
  if (!cleaned) return { ok: false, error: 'Empty expression' };

  try {
    const scope = buildScope(angleUnit, ans);
    const result = math.evaluate(cleaned, scope);
    if (typeof result === 'number') {
      if (Number.isNaN(result)) {
        return { ok: false, error: 'Undefined (NaN)' };
      }
      return {
        ok: true,
        value: result,
        formatted: formatSciNumber(result, forceScientific),
      };
    }
    if (typeof result === 'object' && result !== null && 're' in result && 'im' in result) {
      const c = result as { re: number; im: number };
      const reStr = formatSciNumber(c.re, forceScientific);
      const imAbs = formatSciNumber(Math.abs(c.im), forceScientific);
      const sign = c.im >= 0 ? '+' : '-';
      return {
        ok: true,
        value: c.re,
        formatted: c.im === 0 ? reStr : `${reStr} ${sign} ${imAbs}i`,
      };
    }
    return {
      ok: true,
      value: Number(result),
      formatted: String(result),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Syntax error',
    };
  }
}

export interface PlotPoint {
  x: number;
  y: number | null;
}

export function sampleFunction(
  rawExpression: string,
  xMin: number,
  xMax: number,
  steps: number,
  angleUnit: AngleUnit
): PlotPoint[] {
  const cleaned = normalizeExpression(rawExpression);
  if (!cleaned) return [];
  const points: PlotPoint[] = [];
  let compiled: { evaluate: (scope?: Record<string, unknown>) => unknown } | null = null;
  try {
    compiled = math.compile(cleaned) as { evaluate: (scope?: Record<string, unknown>) => unknown };
  } catch {
    return [];
  }

  const dx = (xMax - xMin) / steps;
  for (let i = 0; i <= steps; i++) {
    const x = xMin + i * dx;
    try {
      const scope = buildScope(angleUnit, 0, { x });
      const y = compiled.evaluate(scope);
      if (typeof y === 'number' && Number.isFinite(y) && Math.abs(y) < 1e7) {
        points.push({ x, y });
      } else {
        points.push({ x, y: null });
      }
    } catch {
      points.push({ x, y: null });
    }
  }
  return points;
}

// Fast local spoken-math parser for zero-latency voice commands
const WORD_NUMBERS: Record<string, string> = {
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
  thirteen: '13',
  fourteen: '14',
  fifteen: '15',
  sixteen: '16',
  seventeen: '17',
  eighteen: '18',
  nineteen: '19',
  twenty: '20',
  thirty: '30',
  forty: '40',
  fifty: '50',
  sixty: '60',
  seventy: '70',
  eighty: '80',
  ninety: '90',
  hundred: '100',
  thousand: '1000',
  million: '1000000',
};

const HINDI_WORD_NUMBERS: Record<string, string> = {
  'शून्य': '0',
  'जीरो': '0',
  'एक': '1',
  'दो': '2',
  'तीन': '3',
  'चार': '4',
  'पांच': '5',
  'पाँच': '5',
  'छह': '6',
  'छः': '6',
  'सात': '7',
  'आठ': '8',
  'नौ': '9',
  'दस': '10',
  'ग्यारह': '11',
  'बारह': '12',
  'तेरह': '13',
  'चौदह': '14',
  'पंद्रह': '15',
  'पन्द्रह': '15',
  'सोलह': '16',
  'सत्रह': '17',
  'अठारह': '18',
  'उन्नीस': '19',
  'बीस': '20',
  'पच्चीस': '25',
  'तीस': '30',
  'चालीस': '40',
  'पचास': '50',
  'साठ': '60',
  'सत्तर': '70',
  'अस्सी': '80',
  'नब्बे': '90',
  'सौ': '100',
  'हजार': '1000',
  'हज़ार': '1000',
};

export function cleanNumericString(text: string): string {
  return text.replace(/(^|[^.\d])(-?\d+)\.0+(?![.\d])/g, '$1$2');
}

export function tryFastVoiceParse(spoken: string): string | null {
  let text = spoken.toLowerCase().trim();
  if (!text) return null;

  // Reject queries that clearly belong to converter or graph so AI/intent router handles them
  if (
    /\b(convert|to\s+[a-z]+\s*$|graph|plot)\b/.test(text)
  ) {
    return null;
  }

  text = text
    .replace(/[?=।!]+/g, ' ')
    .replace(/^(calculate|compute|evaluate|what is|what's|find|solve|tell me|बताओ|बताइए)\s+/i, '')
    .replace(/\s*(कितना\s+होता\s+है|कितना\s+होगा|कितना\s+हुआ|कितना\s+है|क्या\s+होता\s+है|क्या\s+होगा|क्या\s+है|का\s+मान|बताओ|बताइए|बराबर|kitna\s+hota\s+hai|kitna\s+hoga|kitna\s+hua|kitna\s+hai|kya\s+hota\s+hai|kya\s+hai|batao|barabar|equals|equal\s+to)\s*$/gi, '')
    .replace(/(\d+(?:\.\d+)?)\s*का\s*(वर्गमूल|स्क्वायर\s*रूट)/g, 'sqrt($1)')
    .replace(/(\d+(?:\.\d+)?)\s*का\s*(घनमूल|क्यूब\s*रूट)/g, 'cbrt($1)')
    .replace(/(\d+(?:\.\d+)?)\s*का\s*(वर्ग|स्क्वायर)/g, '($1)^2')
    .replace(/(\d+(?:\.\d+)?)\s*का\s*(घन|क्यूब)/g, '($1)^3')
    .replace(/(\d+(?:\.\d+)?)\s*का\s*(\d+(?:\.\d+)?)\s*(%|प्रतिशत|percent)/g, '$1*$2%')
    .replace(/\bpi\b|पाई/g, 'pi')
    .replace(/\bplus\b|\badd\b|प्लस|जोड़ें|जोड़|और/g, '+')
    .replace(/\bminus\b|\bsubtract\b|माइनस|घटाएं|घटा/g, '-')
    .replace(/\btimes\b|\bmultiplied by\b|\bmultiply\b|\binto\b|गुणा|गुना/g, '*')
    .replace(/\bdivided by\b|\bdivide by\b|\bover\b|भागा|भाग|बटे/g, '/')
    .replace(/\bsquared\b/g, '^2')
    .replace(/\bcubed\b/g, '^3')
    .replace(/\bto the power of\b|\braised to\b/g, '^')
    .replace(/\bsquare root of\b|\bsqrt of\b/g, 'sqrt(')
    .replace(/\bcube root of\b/g, 'cbrt(')
    .replace(/\bsine of\b|\bsin of\b/g, 'sin(')
    .replace(/\bcosine of\b|\bcos of\b/g, 'cos(')
    .replace(/\btangent of\b|\btan of\b/g, 'tan(')
    .replace(/\bnatural log of\b|\bln of\b/g, 'ln(')
    .replace(/\blog of\b|\blog base 10 of\b/g, 'log10(')
    .replace(/\bdegrees?\b/g, '')
    .replace(/\bpercent of\b/g, '*0.01*')
    .replace(/\bpercent\b|प्रतिशत/g, '%')
    .replace(/\bmodulo\b|\bmod\b/g, ' mod ');

  for (const [word, digit] of Object.entries(WORD_NUMBERS)) {
    text = text.replace(new RegExp(`\\b${word}\\b`, 'g'), digit);
  }

  for (const [hiWord, digit] of Object.entries(HINDI_WORD_NUMBERS)) {
    text = text.replace(new RegExp(hiWord, 'g'), ` ${digit} `);
  }

  // Balance unclosed parentheses
  const openCount = (text.match(/\(/g) || []).length;
  const closeCount = (text.match(/\)/g) || []).length;
  if (openCount > closeCount) {
    text += ')'.repeat(openCount - closeCount);
  }

  // Clean extra whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // Validate only math-safe characters remain
  if (!/^[0-9+\-*/^().%\s,a-zA-Z]+$/.test(text)) {
    return null;
  }

  const check = evaluateExpression(text, 'DEG', 0);
  return check.ok ? text : null;
}
