import {
  Database,
  Fact,
  Inequality,
  InternalConclusion,
  InternalPartialRule,
  Proposition,
  dbToString,
  insertFact,
  step,
} from './datalog';
import { Pattern, freeVars, parseData, parsePattern } from './terms';
import readline from 'readline';

type CompiledRule = {
  seed: string;
  premise: { [name: string]: InternalPartialRule };
  conclusion: { [name: string]: InternalConclusion };
};

interface Program {
  rules: { [name: string]: InternalPartialRule };
  conclusions: { [r: string]: InternalConclusion };
  db: Database;
}

interface Conclusion {
  name: string;
  args: Pattern[];
  values: Pattern[];
  exhaustive: boolean;
}

type Declaration =
  | { type: 'Fact'; fact: Fact }
  | { type: 'Constraint'; premises: (Proposition | Inequality)[] }
  | { type: 'Rule'; premises: (Proposition | Inequality)[]; conclusion: Conclusion };

function indexToRuleName(index: number): string {
  if (index >= 26) {
    return `${indexToRuleName(Math.floor(index / 26))}${String.fromCharCode(97 + index % 26)}`;
  }
  return String.fromCharCode(97 + index);
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
): Conclusion {
  return {
    name,
    args: args.map(parsePattern),
    values: values.map(parsePattern),
    exhaustive,
  };
}

function concy(
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

export function compilePremises(
  rule: string,
  premises: (Proposition | Inequality)[],
): {
  seed: string;
  rules: [string, InternalPartialRule][];
  conclusion: string;
  boundVars: Set<string>;
} {
  const knownFreeVars = new Set<string>();
  const rules = premises.map((premise, i): [string, InternalPartialRule] => {
    const thisPartial = `${rule}${i}`;
    const nextPartial = `${rule}${i + 1}`;
    switch (premise.type) {
      case 'Inequality': {
        const fv = freeVars(premise.a, premise.b);
        for (const v of fv) {
          if (!knownFreeVars.has(v)) {
            throw new Error(`Variable '${v}' not defined before being used in an inequality.`);
          }
        }
        return [thisPartial, { next: [nextPartial], shared: [...fv], premise }];
      }

      case 'Proposition': {
        const fv = freeVars(...premise.args);
        const shared = [];
        for (const v of fv) {
          if (knownFreeVars.has(v)) {
            shared.push(v);
          } else {
            knownFreeVars.add(v);
          }
        }
        return [thisPartial, { next: [nextPartial], shared, premise }];
      }
    }
  });

  return {
    seed: `${rule}0`,
    rules,
    conclusion: `${rule}${premises.length}`,
    boundVars: knownFreeVars,
  };
}

export function compile(decls: Declaration[]): Program {
  const program: Program = {
    rules: {},
    conclusions: {},
    db: { facts: {}, factValues: {}, prefixes: {}, queue: [] },
  };

  for (let i = 0; i < decls.length; i++) {
    const decl = decls[i];
    const declName = indexToRuleName(i);
    switch (decl.type) {
      case 'Fact': {
        const args = decl.fact.args.slice(0, decl.fact.args.length - 1);
        const value = decl.fact.args[decl.fact.args.length - 1];
        program.db = insertFact(decl.fact.name, args, value, program.db);
        break;
      }

      case 'Constraint': {
        const { seed, rules, conclusion } = compilePremises(declName, decl.premises);
        for (const [name, rule] of rules) {
          program.rules[name] = rule;
        }
        program.db.prefixes[seed] = [{}];
        program.db.queue.push({ type: 'Prefix', name: seed, args: {} });
        program.conclusions[conclusion] = { type: 'Contradiction' };
        break;
      }

      case 'Rule': {
        const { seed, rules, conclusion, boundVars } = compilePremises(declName, decl.premises);

        const headVars = freeVars(...decl.conclusion.args, ...decl.conclusion.values);
        for (const v of headVars) {
          if (!boundVars.has(v)) {
            throw new Error(`Variable '${v}' used in head of rule but not defined in a premise.`);
          }
        }

        for (const [name, rule] of rules) {
          program.rules[name] = rule;
        }
        program.db.prefixes[seed] = [{}];
        program.db.queue.push({ type: 'Prefix', name: seed, args: {} });
        program.conclusions[conclusion] = {
          type: 'NewFact',
          name: decl.conclusion.name,
          args: decl.conclusion.args,
          exhaustive: decl.conclusion.exhaustive,
          values: decl.conclusion.values,
        };
        break;
      }
    }
  }

  return program;
}

function makeExample(rules: CompiledRule[], facts: Fact[]): Program {
  const example: Program = {
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

export const edgeExample = compile([
  { type: 'Fact', fact: fact('edge', ['a', 'b']) },
  { type: 'Fact', fact: fact('edge', ['b', 'c']) },
  { type: 'Fact', fact: fact('edge', ['c', 'd']) },
  { type: 'Fact', fact: fact('edge', ['d', 'e']) },
  { type: 'Fact', fact: fact('edge', ['e', 'f']) },
  { type: 'Fact', fact: fact('edge', ['f', 'g']) },
  { type: 'Fact', fact: fact('edge', ['f', 'c']) },
  { type: 'Rule', premises: [prop('edge', ['X', 'Y'])], conclusion: conc('path', ['X', 'Y']) },
  {
    type: 'Rule',
    premises: [prop('edge', ['X', 'Y']), prop('path', ['Y', 'Z'])],
    conclusion: conc('path', ['X', 'Z']),
  },
]);

/*
 *
 * EXAMPLE 2: some mutual exclusion
 *
 */

export const mutexExample2

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
    a2: concy('a', [], ['true', 'false']),
    a3: concy('b', [], ['true', 'false']),
    a4: concy('c', [], ['true', 'false']),
  },
};
const r2: CompiledRule = {
  seed: 'b1',
  premise: {},
  conclusion: {
    b1: concy('p', [], ['false'], false),
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
    c2: concy('q1', [], ['true']),
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
    d2: concy('a', [], ['true']),
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
    a2: concy('species', ['C'], ['cat', 'dog']),
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
    b2: concy('home', ['C'], ['uplands', 'lowlands', 'catlands', 'doghouse']),
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
    c2: concy('species', ['C'], ['dog']),
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
  [fact('character', ['celeste']), fact('character', ['nimbus'])],
);

/*
 *
 * Execution
 *
 */
const inter = readline.promises.createInterface({ input: process.stdin, output: process.stdout });
async function run(example: Program) {
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

run(edgeExample).then(() => {
  process.exit();
});
