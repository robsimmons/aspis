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
    return `${indexToRuleName(Math.floor(index / 26))}${String.fromCharCode(97 + (index % 26))}`;
  }
  return String.fromCharCode(97 + index);
}

function prop(name: string, args: string[], value: string = '()'): Proposition {
  return { type: 'Proposition', name, args: [...args.map(parsePattern), parsePattern(value)] };
}

function neq(a: string, b: string): Inequality {
  return { type: 'Inequality', a: parsePattern(a), b: parsePattern(b) };
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

export const aspExample1 = compile([
  // { a, b, c } :- !p.
  { type: 'Rule', premises: [], conclusion: conc('p', [], ['false'], false) },
  {
    type: 'Rule',
    premises: [prop('p', [], 'false')],
    conclusion: conc('a', [], ['true', 'false']),
  },
  {
    type: 'Rule',
    premises: [prop('p', [], 'false')],
    conclusion: conc('b', [], ['true', 'false']),
  },
  {
    type: 'Rule',
    premises: [prop('p', [], 'false')],
    conclusion: conc('c', [], ['true', 'false']),
  },

  // q :- !p.
  { type: 'Rule', premises: [], conclusion: conc('p', [], ['false'], false) },
  { type: 'Rule', premises: [prop('p', [], 'false')], conclusion: conc('q', [], ['true']) },

  // a :- q.
  { type: 'Rule', premises: [prop('q', [], 'true')], conclusion: conc('a', [], ['true']) },
]);

/*
 *
 * Character creation
 *
 */
export const characterCreator = compile([
  // Four characters
  { type: 'Fact', fact: fact('character', ['celeste']) },
  { type: 'Fact', fact: fact('character', ['nimbus']) },
  { type: 'Fact', fact: fact('character', ['terra']) },
  { type: 'Fact', fact: fact('character', ['luna']) },

  // left is { celeste, nimbus, terra, luna } :-.
  // right is { celeste, nimbus, terra, luna } :-.
  // :- left is C, right is C.
  // :- left is C1, race C1 is R, right is C2, race C2 is R.

  {
    type: 'Rule',
    premises: [],
    conclusion: conc('left', [], ['celeste', 'nimbus', 'terra', 'luna']),
  },

  // Every character has a home in one of four places
  {
    type: 'Rule',
    premises: [prop('character', ['C'])],
    conclusion: conc('home', ['C'], ['uplands', 'lowlands', 'catlands', 'doghouse']),
  },

  // Every character is one of four races
  {
    type: 'Rule',
    premises: [prop('character', ['C'])],
    conclusion: conc('race', ['C'], ['cat', 'dog', 'horse', 'bird']),
  },

  // Birds live in the uplands
  {
    type: 'Rule',
    premises: [prop('race', ['C'], 'bird')],
    conclusion: conc('home', ['C'], ['uplands']),
  },

  // Only dogs live in the doghouse
  {
    type: 'Rule',
    premises: [prop('home', ['C'], 'doghouse')],
    conclusion: conc('race', ['C'], ['dog']),
  },

  // Celeste and nimbus live in the same place and have the same race (this demonstrates
  // two different ways of doing the same thing)
  {
    type: 'Constraint',
    premises: [prop('home', ['nimbus'], 'H1'), prop('home', ['celeste'], 'H2'), neq('H1', 'H2')],
  },
  {
    type: 'Rule',
    premises: [prop('race', ['nimbus'], 'R')],
    conclusion: conc('race', ['celeste'], ['R']),
  },

  // Luna and terra live in different places
  {
    type: 'Constraint',
    premises: [prop('home', ['luna'], 'H'), prop('home', ['terra'], 'H')],
  },

  // At most one person in the doghouse
  {
    type: 'Constraint',
    premises: [prop('home', ['C1'], 'doghouse'), prop('home', ['C2'], 'doghouse'), neq('C1', 'C2')],
  },

  // Birds avoid the catlands
  {
    type: 'Constraint',
    premises: [prop('race', ['C'], 'bird'), prop('home', ['C'], 'catlands')],
  },
]);

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

run(characterCreator).then(() => {
  process.exit();
});
