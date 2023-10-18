import { compile } from './compile';
import { Database, Program, dbToString, step } from './datalog';
import { Conclusion, Declaration, Inequality, Proposition } from './syntax';
import { parsePattern } from './terms';
import readline from 'readline';

function prop(name: string, args: string[], value: string = '()'): Proposition {
  return { type: 'Proposition', name, args: [...args.map(parsePattern), parsePattern(value)] };
}

function neq(a: string, b: string): Inequality {
  return { type: 'Inequality', a: parsePattern(a), b: parsePattern(b) };
}

function fact(name: string, args: string[], value: string = '()'): Declaration {
  return { type: 'Rule', premises: [], conclusion: conc(name, args, [value], null) };
}

function conc(
  name: string,
  args: string[],
  values: string[] = ['()'],
  isThereMore: null | '...' = null,
): Conclusion {
  return {
    name,
    args: args.map(parsePattern),
    values: values.map(parsePattern),
    exhaustive: isThereMore === null,
  };
}

/*
 *
 * EXAMPLE 1: edge/path
 *
 */

export const edgeExample = compile([
  fact('edge', ['a', 'b']),
  fact('edge', ['b', 'c']),
  fact('edge', ['c', 'd']),
  fact('edge', ['d', 'e']),
  fact('edge', ['e', 'f']),
  fact('edge', ['f', 'c']),
  fact('edge', ['g', 'f']),
  fact('edge', ['j', 'g']),
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
  { type: 'Rule', premises: [], conclusion: conc('p', [], ['false'], '...') },
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
  { type: 'Rule', premises: [], conclusion: conc('p', [], ['false'], '...') },
  { type: 'Rule', premises: [prop('p', [], 'false')], conclusion: conc('q', [], ['true']) },

  // a :- q.
  { type: 'Rule', premises: [prop('q', [], 'true')], conclusion: conc('a', [], ['true']) },
]);

/*
 *
 * Numbers
 *
 */
export const nats = compile([
  fact('even', ['10']),
  { type: 'Rule', premises: [prop('even', ['s(X)'])], conclusion: conc('odd', ['X']) },
  { type: 'Rule', premises: [prop('odd', ['s(X)'])], conclusion: conc('even', ['X']) },
]);

export const ints = compile([
  { type: 'Rule', premises: [], conclusion: conc('a', [], ['1', '2', '3', '4', '5', '6', '7']) },
  {
    type: 'Rule',
    premises: [],
    conclusion: conc('b', [], ['-1', '2', '-3', '4', '-5', '6', '-6']),
  },
  { type: 'Rule', premises: [], conclusion: conc('c', [], ['1', '2', '3', '4', '5', '6', '7']) },
  {
    type: 'Rule',
    premises: [prop('a', [], 'A'), prop('b', [], 'B')],
    conclusion: conc('c', [], ['plus A B']),
  },
]);

/*
 *
 * Character creation
 *
 */
export const characterCreator = compile([
  // Four characters
  fact('character', ['celeste']),
  fact('character', ['nimbus']),
  fact('character', ['luna']),
  fact('character', ['terra']),

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

run(ints).then(() => {
  process.exit();
});
