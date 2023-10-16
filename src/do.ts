import {
  Database,
  DbItem,
  Fact,
  InternalConclusion,
  InternalRule,
  PartialRule,
  Proposition,
  step,
} from './datalog';
import { parseData, parsePattern, termToString } from './terms';

console.log('Hi');

function prop(name: string, args: string[], values: string[]): Proposition {
  return { name, args: args.map(parsePattern), values: values.map(parsePattern) };
}

function fact(name: string, args: string[], values: string[]): Fact {
  return { type: 'Fact', name, args: args.map(parseData), values: values.map(parseData) };
}

function propToString(p: Proposition) {
  if (p.values.length === 0) {
    return `${p.name}${p.args.map((arg) => ` ${termToString(arg)}`).join('')}`;
  }
  return `${p.name}${p.args.map((arg) => ` ${termToString(arg)}`).join('')} =${p.values.map(
    (value) => ` ${termToString(value)}`,
  )}`;
}

function factToString(f: Fact): string {
  return propToString(f);
}

function partialRuleToString(f: PartialRule): string {
  return `${f.name}{ ${Object.entries(f.args)
    .map(([varName, term]) => `${termToString(term)}/${varName}`)
    .join(', ')} }`;
}

function dbItemToString(i: DbItem) {
  if (i.type === 'Fact') return factToString(i);
  return partialRuleToString(i);
}

function dbToString(db: Database): string {
  return `Queue:
${db.queue.map((item) => dbItemToString(item)).join('\n')}
Database:
${db.facts.map((item) => factToString(item)).join('\n')}
${db.partialRules.map((item) => partialRuleToString(item))}
`;
}

console.log(propToString(prop('x', [`"abc"`, `s(s z)`], [`true`])));

type CompiledRule = {
  seed: PartialRule;
  premise: InternalRule[];
  conclusion: { [name: string]: InternalConclusion };
};

// `path X Y :- edge X Y`
const a: CompiledRule = {
  seed: { type: 'PartialRule', name: 'a1', args: {} },
  premise: [
    {
      name: 'a1',
      nextName: ['a2'],
      independent: [],
      shared: [],
      new: ['X', 'Y'],
      premise: prop('edge', ['X', 'Y'], []),
    },
  ],
  conclusion: {
    a2: {
      mutuallyExclusiveConclusions: [prop('path', ['X', 'Y'], [])],
      exhaustive: true,
    },
  },
};

// `path X Z :- edge X Y, path Y Z`
const b: CompiledRule = {
  seed: { type: 'PartialRule', name: 'b1', args: {} },
  premise: [
    {
      name: 'b1',
      nextName: ['b2'],
      independent: [],
      shared: [],
      new: ['X', 'Y'],
      premise: prop('edge', ['X', 'Y'], []),
    },
    {
      name: 'b2',
      nextName: ['b3'],
      independent: ['X'],
      shared: ['Y'],
      new: ['Z'],
      premise: prop('path', ['Y', 'Z'], []),
    },
  ],
  conclusion: {
    b3: {
      mutuallyExclusiveConclusions: [prop('path', ['X', 'Z'], [])],
      exhaustive: true,
    },
  },
};

const rules = [...a.premise, ...b.premise];
const conclusions = { ...a.conclusion, ...b.conclusion };
let db: Database = {
  facts: [
    fact('edge', ['a', 'b'], []),
    fact('edge', ['b', 'c'], []),
    fact('edge', ['c', 'd'], []),
    fact('edge', ['d', 'e'], []),
  ],
  partialRules: [a.seed, b.seed],
  uninteresting: [],
  queue: [a.seed, b.seed],
};

let loop = 0;
while (db.queue.length > 0) {
  console.log(`-- ${++loop} --`);
  db = step(rules, conclusions, db)[0];
  console.log(dbToString(db));
}
