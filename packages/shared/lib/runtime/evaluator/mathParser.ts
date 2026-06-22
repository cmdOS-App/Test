/**
 * A safe, lightweight mathematical parser for basic arithmetic.
 * Supports +, -, *, /, (, ) and numbers.
 * Does NOT use eval() or Function() for security and simplicity.
 */

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let numStr = '';
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (/\s/.test(c)) continue;
    if (/[\+\-\*\/\(\)]/.test(c)) {
      if (numStr) {
        tokens.push(numStr);
        numStr = '';
      }
      tokens.push(c);
    } else if (/[0-9\.]/.test(c)) {
      numStr += c;
    } else {
      throw new Error(`Invalid character in expression: ${c}`);
    }
  }
  if (numStr) tokens.push(numStr);
  return tokens;
}

function parseTokens(tokens: string[]): number {
  let pos = 0;

  function parseExpression(): number {
    let result = parseTerm();
    while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
      const op = tokens[pos++];
      const term = parseTerm();
      if (op === '+') result += term;
      else result -= term;
    }
    return result;
  }

  function parseTerm(): number {
    let result = parseFactor();
    while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/')) {
      const op = tokens[pos++];
      const factor = parseFactor();
      if (op === '*') result *= factor;
      else {
        if (factor === 0) throw new Error('Division by zero');
        result /= factor;
      }
    }
    return result;
  }

  function parseFactor(): number {
    if (pos >= tokens.length) throw new Error('Unexpected end of expression');
    const token = tokens[pos++];
    if (token === '(') {
      const result = parseExpression();
      if (pos >= tokens.length || tokens[pos++] !== ')') {
        throw new Error('Missing closing parenthesis');
      }
      return result;
    } else if (token === '-') {
      return -parseFactor();
    } else if (token === '+') {
      return parseFactor();
    }
    const num = parseFloat(token);
    if (isNaN(num)) {
      throw new Error(`Invalid number: ${token}`);
    }
    return num;
  }

  const res = parseExpression();
  if (pos < tokens.length) {
    throw new Error(`Unexpected token at end: ${tokens[pos]}`);
  }
  return res;
}

export function evaluateSafeMath(expr: string): number {
  if (!expr || !expr.trim()) return 0;
  try {
    const tokens = tokenize(expr);
    if (tokens.length === 0) return 0;
    return parseTokens(tokens);
  } catch (e) {
    console.warn('[MathParser] Evaluation error:', e, 'Expression:', expr);
    return NaN; // Return NaN to indicate a computation error safely
  }
}
