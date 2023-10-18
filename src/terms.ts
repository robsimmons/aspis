export type Pattern =
  | { type: 'const'; name: string; args: Pattern[] }
  | { type: 'int'; value: number }
  | { type: 'string'; value: string }
  | { type: 'var'; name: string }
  | { type: 'triv' };

export type Data =
  | { type: 'const'; name: string; args: Data[] }
  | { type: 'int'; value: number }
  | { type: 'string'; value: string }
  | { type: 'triv' };

export type Substitution = { [varName: string]: Data };

export function match(
  substitution: Substitution,
  pattern: Pattern,
  data: Data,
): null | Substitution {
  switch (pattern.type) {
    case 'const':
      if (
        data.type !== 'const' ||
        pattern.name !== data.name ||
        pattern.args.length !== data.args.length
      )
        return null;
      for (let i = 0; i < pattern.args.length; i++) {
        const candidate = match(substitution, pattern.args[i], data.args[i]);
        if (candidate === null) return null;
        substitution = candidate;
      }
      return substitution;
    case 'int':
    case 'string':
      if (pattern.type !== data.type) return null;
      if (pattern.value !== data.value) return null;
      return substitution;
    case 'triv':
      if (pattern.type !== data.type) return null;
      return substitution;
    case 'var':
      if (substitution[pattern.name]) return match(substitution, substitution[pattern.name], data);
      return { [pattern.name]: data, ...substitution };
  }
}

export function apply(substitution: Substitution, pattern: Pattern): Data {
  switch (pattern.type) {
    case 'int':
    case 'string':
    case 'triv':
      return pattern;
    case 'var':
      const result = substitution[pattern.name];
      if (!result) {
        throw new Error(
          `Free variable '${pattern.name}' not assigned to in grounding substitution`,
        );
      }
      return result;
    case 'const':
      return {
        type: 'const',
        name: pattern.name,
        args: pattern.args.map((arg) => apply(substitution, arg)),
      };
  }
}

export function equal(t: Data, s: Data): boolean {
  switch (t.type) {
    case 'int':
    case 'string':
      return t.type === s.type && t.value !== s.value;
    case 'triv':
      return t.type === s.type;
    case 'const':
      return (
        t.type === s.type &&
        t.name === s.name &&
        t.args.length === s.args.length &&
        t.args.every((arg, i) => equal(arg, s.args[i]))
      );
  }
}

export function termToString(t: Pattern): string {
  switch (t.type) {
    case 'const':
      return t.args.length === 0
        ? t.name
        : `(${t.name} ${t.args.map((arg) => termToString(arg)).join(' ')})`;
    case 'int':
      return `${t.value}`;
    case 'string':
      return `"${t.value}"`;
    case 'triv':
      return `()`;
    case 'var':
      return t.name;
  }
}

export function assertData(p: Pattern): Data {
  switch (p.type) {
    case 'int':
    case 'string':
    case 'triv':
      return p;
    case 'const':
      return { type: 'const', name: p.name, args: p.args.map((arg) => assertData(arg)) };
    case 'var':
      throw new Error(`Found variable '${p.name}' where only variable-free data was expected`);
  }
}

export function parseTerm(s: string): { data: Pattern; rest: string } | null {
  if (s[0] === '"') {
    const end = s.slice(1).indexOf('"');
    if (end === -1) {
      throw new Error('Unmatched quote');
    }
    return {
      data: { type: 'string', value: s.slice(1, end + 1) },
      rest: s.slice(end + 2).trimStart(),
    };
  }

  if (s[0] === '(') {
    if (s[1] === ')') {
      return { data: { type: 'triv' }, rest: s.slice(2).trimStart() };
    }
    let next = parseTerm(s.slice(1));
    if (next === null) {
      throw new Error('No term following an open parenthesis');
    }
    if (next.rest[0] !== ')') {
      throw new Error('Did not find expected matching parenthesis');
    }
    return { data: next.data, rest: next.rest.slice(1).trimStart() };
  }

  const constMatch = s.match(/^[0-9a-zA-Z]+/);
  if (constMatch) {
    if (constMatch[0].match(/^[A-Z]/)) {
      return {
        data: { type: 'var', name: constMatch[0] },
        rest: s.slice(constMatch[0].length).trimStart(),
      };
    }
    if (constMatch[0].match(/^[0-9]/)) {
      if (`${parseInt(constMatch[0])}` !== constMatch[0]) {
        throw new Error(`Bad number: '${constMatch[0]}'`);
      }
      return {
        data: { type: 'int', value: parseInt(constMatch[0]) },
        rest: s.slice(constMatch[0].length).trimStart(),
      };
    }
    let rest = s.slice(constMatch[0].length).trimStart();
    const args = [];
    let next = parseTerm(rest);
    while (next !== null) {
      args.push(next.data);
      rest = next.rest;
      next = parseTerm(next.rest);
    }
    return { data: { type: 'const', name: constMatch[0], args }, rest };
  }

  return null;
}

export function parsePattern(s: string): Pattern {
  const result = parseTerm(s);
  if (result === null) {
    throw new Error(`Could not parse '${s}' as a pattern`);
  }
  if (result.rest !== '') {
    throw new Error(`Unexpected parsing '${s}' as a pattern: '${result.rest[0]}'`);
  }
  return result.data;
}

export function parseData(s: string): Data {
  return assertData(parsePattern(s));
}

function freeVarsAccum(s: Set<string>, p: Pattern) {
  switch (p.type) {
    case 'var':
      s.add(p.name);
      return;
    case 'int':
    case 'string':
    case 'triv':
      return;
    case 'const':
      for (let arg of p.args) {
        freeVarsAccum(s, arg);
      }
      return;
  }
}

export function freeVars(...patterns: Pattern[]): Set<string> {
  const s = new Set<string>();
  for (let pattern of patterns) {
    freeVarsAccum(s, pattern);
  }
  return s;
}
