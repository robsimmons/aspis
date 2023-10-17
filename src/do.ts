import {
  Database,
  Fact,
  InternalConclusion,
  InternalPartialRule,
  Proposition,
  dbToString,
  insertFact,
  step,
} from './datalog';
import { parseData, parsePattern } from './terms';
import readline from 'readline';

type CompiledRule = {
  seed: string;
  premise: { [name: string]: InternalPartialRule };
  conclusion: { [name: string]: InternalConclusion };
};

interface Example {
  rules: { [name: string]: InternalPartialRule };
  conclusions: { [r: string]: InternalConclusion };
  db: Database;
}

function prop(name: string, args: string[], value: string = '()'): Proposition {
  return { type: 'Proposition', name, args: [...args.map(parsePattern), parsePattern(value)] };
}

function fact(name: string, args: string[], value: string = '()'): Fact {
  return { type: 'Fact', name, args: [...args.map(parseData), parseData(value)] };
}

function conc(
  name: string,
  args: string[],
  values: string[] = ['()'],
  exhaustive: boolean = true,
): InternalConclusion {
  return {
    type: 'NewFact',
    name,
    args: args.map(parsePattern),
    values: values.map(parsePattern),
    exhaustive,
  };
}

function makeExample(rules: CompiledRule[], facts: Fact[]): Example {
  const example: Example = {
    rules: {},
    conclusions: {},
    db: { facts: {}, factValues: {}, prefixes: {}, queue: [] },
  };
  for (const { seed, premise, conclusion } of rules) {
    example.rules = { ...example.rules, ...premise };
    example.conclusions = { ...example.conclusions, ...conclusion };
    example.db.prefixes[seed] = [{}];
    example.db.queue = [...example.db.queue, { type: 'Prefix', name: seed, args: {} }];
  }
  for (const fact of facts) {
    const args = fact.args.slice(0, fact.args.length - 1);
    const value = fact.args[fact.args.length - 1];
    example.db = insertFact(fact.name, args, value, example.db);
  }
  return example;
}

/*
 *
 * EXAMPLE 1: edge/path
 *
 */

// path X Y :- edge X Y
const a: CompiledRule = {
  seed: 'a1',
  premise: {
    a1: {
      premise: prop('edge', ['X', 'Y']),
      shared: [],
      next: ['a2'],
    },
  },
  conclusion: {
    a2: conc('path', ['X', 'Y']),
  },
};

// path X Z :- edge X Y, path Y Z
const b: CompiledRule = {
  seed: 'b1',
  premise: {
    b1: {
      premise: prop('edge', ['X', 'Y']),
      shared: [],
      next: ['b2'],
    },
    b2: {
      premise: prop('path', ['Y', 'Z']),
      shared: ['Y'],
      next: ['b3'],
    },
  },
  conclusion: {
    b3: conc('path', ['X', 'Z']),
  },
};

export const edgeExample = makeExample(
  [a, b],
  [
    fact('edge', ['a', 'b']),
    fact('edge', ['b', 'c']),
    fact('edge', ['c', 'd']),
    fact('edge', ['d', 'e']),
    fact('edge', ['e', 'f']),
    fact('edge', ['e', 'c']),
  ],
);

/*
 *
 * EXAMPLE 2: some mutual exclusion
 *
 */

// { a, b, c } :- !p.
const r1: CompiledRule = {
  seed: 'a1',
  premise: {
    a1: {
      premise: prop('p', [], 'false'),
      shared: [],
      next: ['a2', 'a3', 'a4'],
    },
  },
  conclusion: {
    a2: conc('a', [], ['true', 'false']),
    a3: conc('b', [], ['true', 'false']),
    a4: conc('c', [], ['true', 'false']),
  },
};
const r2: CompiledRule = {
  seed: 'b1',
  premise: {},
  conclusion: {
    b1: conc('p', [], ['false'], false),
  },
};

// q :- !p.
const r3: CompiledRule = {
  seed: 'c1',
  premise: {
    c1: {
      premise: prop('p', [], 'false'),
      shared: [],
      next: ['c2'],
    },
  },
  conclusion: {
    c2: conc('q1', [], ['true']),
  },
};

// a :- q.
const r4: CompiledRule = {
  seed: 'd1',
  premise: {
    d1: {
      premise: prop('p', [], 'false'),
      shared: [],
      next: ['d2'],
    },
  },
  conclusion: {
    d2: conc('a', [], ['true']),
  },
};

export const mutexExample = makeExample([r1, r2, r3, r4], []);

/*
 *
 * Character creation
 *
 */
const r5: CompiledRule = {
  seed: 'a1',
  premise: {
    a1: {
      premise: prop('character', ['C']),
      shared: [],
      next: ['a2'],
    },
  },
  conclusion: {
    a2: conc('species', ['C'], ['cat', 'dog']),
  },
};

const r6: CompiledRule = {
  seed: 'b1',
  premise: {
    b1: {
      premise: prop('character', ['C']),
      shared: [],
      next: ['b2'],
    },
  },
  conclusion: {
    b2: conc('home', ['C'], ['uplands', 'lowlands', 'catlands', 'doghouse']),
  },
};

const r7: CompiledRule = {
  seed: 'c1',
  premise: {
    c1: {
      premise: prop('home', ['C'], 'doghouse'),
      shared: [],
      next: ['c2'],
    },
  },
  conclusion: {
    c2: conc('species', ['C'], ['dog']),
  },
};

const r8: CompiledRule = {
  seed: 'd1',
  premise: {
    d1: {
      premise: prop('home', ['luna'], 'H'),
      shared: [],
      next: ['d2'],
    },
    d2: {
      premise: prop('home', ['terra'], 'H'),
      shared: ['H'],
      next: ['d3'],
    },
  },
  conclusion: { d3: { type: 'Contradiction' } },
};

const r9: CompiledRule = {
  seed: 'e1',
  premise: {
    e1: {
      premise: prop('home', ['C1'], 'doghouse'),
      shared: [],
      next: ['e2'],
    },
    e2: {
      premise: prop('home', ['C2'], 'doghouse'),
      shared: [],
      next: ['e3'],
    },
    e3: {
      premise: {
        type: 'Inequality',
        a: { type: 'var', name: 'C1' },
        b: { type: 'var', name: 'C2' },
      },
      shared: ['C1', 'C2'],
      next: ['e4'],
    },
  },
  conclusion: { e4: { type: 'Contradiction' } },
};

export const characterExample = makeExample(
  [r5, r6, r7, r8, r9],
  [
    fact('character', ['celeste']),
    fact('character', ['nimbus']),
  ],
);

/*
 *
 * Execution
 *
 */
const inter = readline.promises.createInterface({ input: process.stdin, output: process.stdout });
async function run(example: Example) {
  let dbStack: Database[] = [example.db];
  const saturatedDbs: Database[] = [];

  let loop = 0;
  while (dbStack.length > 0) {
    console.log(`-- ${++loop} (${dbStack.length} working databases) --\n`);
    console.log(dbToString(dbStack[0]));

    if (dbStack[0].queue.length === 0) {
      console.log('DB SATURATED — popping DB queue');
      await inter.question('Continue? ');
      const [saturatedDb, ...rest] = dbStack;
      dbStack = rest;
      saturatedDbs.push(saturatedDb);
    } else {
      const newDbs = step(example.rules, example.conclusions, dbStack[0]);
      if (newDbs.length === 0) {
        console.log('DB FAILED CONSTRAINT - removing DB from consideration');
        dbStack.shift();
      } else if (newDbs.length > 1) {
        console.log(`MULTIPLE DBs - pushing ${newDbs.length - 1} onto stack`);
        for (let i = 1; i < newDbs.length; i++) {
          console.log(`Pushing ${i} of ${newDbs.length - 1}:`);
          console.log(dbToString(newDbs[i]));
        }
        dbStack.shift();
        dbStack.unshift(...newDbs);
      } else {
        dbStack[0] = newDbs[0];
      }
    }
  }

  console.log(`${saturatedDbs.length} saturated database(s)`);
  for (let i = 0; i < saturatedDbs.length; i++) {
    console.log(`Saturated database ${i + 1} of ${saturatedDbs.length}:`);
    console.log(dbToString(saturatedDbs[i]));
  }
}

run(characterExample).then(() => {
  process.exit();
});
