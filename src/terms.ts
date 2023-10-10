export type Pattern =
  | { type: 'const'; name: string; args: Pattern[] }
  | { type: 'int'; value: number }
  | { type: 'string'; value: string }
  | { type: 'var'; name: string };

export type Data =
  | { type: 'const'; name: string; args: Data[] }
  | { type: 'int'; value: number }
  | { type: 'string'; value: string };

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
    case 'var':
      if (substitution[pattern.name]) return match(substitution, substitution[pattern.name], data);
      return { [pattern.name]: data, ...substitution };
  }
}
