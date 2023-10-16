import {
  Database,
  DbItem,
  Fact,
  InternalConclusion,
  InternalRule,
  PartialRule,
  Proposition,
  dbItemToString,
  step,
} from './datalog';
import { parseData, parsePattern } from './terms';

console.log('Hi');

function prop(name: string, args: string[], values: string[]): Proposition {
  return { name, args: args.map(parsePattern), values: values.map(parsePattern) };
}

function fact(name: string, args: string[], values: string[]): Fact {
  return { type: 'Fact', name, args: args.map(parseData), values: values.map(parseData) };
}

function dbToString(db: Database): string {
  return `Queue: ${db.queue.map((item) => dbItemToString(item)).join(', ')}
Database: ${([] as DbItem[])
    .concat(db.facts)
    .concat(db.partialRules)
    .map((item: DbItem) => dbItemToString(item))
    .join(', ')}}
Uninteresting: ${db.uninteresting.map((item) => dbItemToString(item)).join(', ')}
`;
}

type CompiledRule = {
  seed: PartialRule;
  premise: InternalRule[];
  conclusion: { [name: string]: InternalConclusion };
};

/*
 *
 * EXAMPLE 1: edge/path
 *
 */

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

interface Example {
  rules: InternalRule[];
  conclusions: { [r: string]: InternalConclusion };
  db: Database;
}

export const edgeExample: Example = {
  rules: [...a.premise, ...b.premise],
  conclusions: { ...a.conclusion, ...b.conclusion },
  db: {
    facts: [
      fact('edge', ['a', 'b'], []),
      fact('edge', ['b', 'c'], []),
      fact('edge', ['c', 'd'], []),
      fact('edge', ['d', 'e'], []),
      fact('edge', ['c', 'a'], []),
    ],
    partialRules: [a.seed, b.seed],
    uninteresting: [],
    queue: [a.seed, b.seed],
  },
};

/*
 *
 * EXAMPLE 2: mutual exclusion
 *
 */

// { a, b, c } :- !p.
const r1: CompiledRule = {
  seed: { type: 'PartialRule', name: 'a1', args: {} },
  premise: [
    {
      name: 'a1',
      nextName: ['a2', 'a3', 'a4'],
      independent: [],
      shared: [],
      new: [],
      premise: prop('p', [], ['false']),
    },
  ],
  conclusion: {
    a2: {
      mutuallyExclusiveConclusions: [prop('a', [], ['true']), prop('a', [], ['false'])],
      exhaustive: true,
    },
    a3: {
      mutuallyExclusiveConclusions: [prop('b', [], ['true']), prop('b', [], ['false'])],
      exhaustive: true,
    },
    a4: {
      mutuallyExclusiveConclusions: [prop('c', [], ['true']), prop('c', [], ['false'])],
      exhaustive: true,
    },
  },
};
const r2: CompiledRule = {
  seed: { type: 'PartialRule', name: 'b1', args: {} },
  premise: [],
  conclusion: {
    b1: {
      mutuallyExclusiveConclusions: [prop('p', [], ['false'])],
      exhaustive: false,
    },
  },
};
// q :- !p.
const r3: CompiledRule = {
  seed: { type: 'PartialRule', name: 'c1', args: {} },
  premise: [
    {
      name: 'c1',
      nextName: ['c2'],
      independent: [],
      shared: [],
      new: [],
      premise: prop('p', [], ['false']),
    },
  ],
  conclusion: {
    c2: { mutuallyExclusiveConclusions: [prop('q', [], ['true'])], exhaustive: true },
  },
};
// a :- q.
const r4: CompiledRule = {
  seed: { type: 'PartialRule', name: 'd1', args: {} },
  premise: [
    {
      name: 'd1',
      nextName: ['d2'],
      independent: [],
      shared: [],
      new: [],
      premise: prop('q', [], ['true']),
    },
  ],
  conclusion: {
    d2: { mutuallyExclusiveConclusions: [prop('a', [], ['true'])], exhaustive: true },
  },
};

export const mutexExample: Example = {
  rules: [...r1.premise, ...r2.premise, ...r3.premise, ...r4.premise],
  conclusions: { ...r1.conclusion, ...r2.conclusion, ...r3.conclusion, ...r4.conclusion },
  db: {
    facts: [],
    partialRules: [r1.seed, r2.seed, r3.seed, r4.seed],
    uninteresting: [],
    queue: [r1.seed, r2.seed, r3.seed, r4.seed],
  },
};

/*
 *
 * np nq
 *
 */
const r5: CompiledRule = {
  seed: { type: 'PartialRule', name: 'a1', args: {} },
  premise: [
    {
      name: 'a1',
      nextName: ['a2'],
      independent: [],
      shared: [],
      new: [],
      premise: prop('q', [], ['false']),
    },
  ],
  conclusion: {
    a2: { mutuallyExclusiveConclusions: [prop('p', [], ['true'])], exhaustive: true },
  },
};

const r6: CompiledRule = {
  seed: { type: 'PartialRule', name: 'b1', args: {} },
  premise: [],
  conclusion: {
    b1: { mutuallyExclusiveConclusions: [prop('p', [], ['false'])], exhaustive: false },
  },
};

const r7: CompiledRule = {
  seed: { type: 'PartialRule', name: 'c1', args: {} },
  premise: [
    {
      name: 'c1',
      nextName: ['c2'],
      independent: [],
      shared: [],
      new: [],
      premise: prop('p', [], ['false']),
    },
  ],
  conclusion: {
    c2: { mutuallyExclusiveConclusions: [prop('q', [], ['true'])], exhaustive: true },
  },
};

const r8: CompiledRule = {
  seed: { type: 'PartialRule', name: 'd1', args: {} },
  premise: [],
  conclusion: {
    d1: { mutuallyExclusiveConclusions: [prop('q', [], ['false'])], exhaustive: false },
  },
};

export const pqExample: Example = {
  rules: [...r5.premise, ...r6.premise, ...r7.premise, ...r8.premise],
  conclusions: { ...r5.conclusion, ...r6.conclusion, ...r7.conclusion, ...r8.conclusion },
  db: {
    facts: [],
    partialRules: [r5.seed, r6.seed, r7.seed, r8.seed],
    uninteresting: [],
    queue: [r5.seed, r6.seed, r7.seed, r8.seed],
  },
};

/*
 *
 * Execution
 *
 */
const current = pqExample;

let workingDbs: Database[] = [current.db];
const saturatedDbs: Database[] = [];
const rules = current.rules;
const conclusions = current.conclusions;

let loop = 0;
while (workingDbs.length > 0) {
  console.log(`-- ${++loop} (${workingDbs.length} working databases) --\n`);
  console.log(dbToString(workingDbs[0]));
  console.log('\n');
  if (workingDbs[0].queue.length === 0) {
    console.log('DB SATURATED — popping DB queue');
    const [saturatedDb, ...rest] = workingDbs;
    workingDbs = rest;
    saturatedDbs.push(saturatedDb);
  } else {
    const newDbs = step(rules, conclusions, workingDbs[0]);
    if (newDbs.length === 0) {
      console.log('DB FAILED CONSTRAINT - removing DB from consideration');
      workingDbs.shift();
    } else if (newDbs.length > 1) {
      console.log(`MULTIPLE DBs - pushing ${newDbs.length - 1} onto stack`);
      for (let i = 1; i < newDbs.length; i++) {
        console.log(`Pushing ${i} of ${newDbs.length - 1}:`);
        console.log(dbToString(newDbs[i]));
      }
      workingDbs.shift();
      workingDbs.unshift(...newDbs);
    } else {
      workingDbs[0] = newDbs[0];
    }
  }
}

console.log(`${saturatedDbs.length} saturated database(s)`);
for (let i = 0; i < saturatedDbs.length; i++) {
  console.log(`Saturated database ${i + 1} of ${saturatedDbs.length}:`);
  console.log(dbToString(saturatedDbs[i]));
}
