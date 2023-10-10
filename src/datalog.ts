import { Substitution, Pattern, Data, match, eqData } from './terms';

type Proposition = { name: string; args: Pattern[]; values: Pattern[] };

type Fact = { name: string; args: Data[]; values: Data[] };

/**
 * A Rule is
 * (A /\ B /\ C) => ( (D /\ E) \/ G \/ (G /\ H) )
 */
type Rule = { premises: Proposition[]; conclusion: Proposition[][] };

function matchFact(
  substitution: Substitution,
  proposition: Proposition,
  fact: Fact,
): null | Substitution {
  if (
    proposition.name !== fact.name ||
    proposition.args.length !== fact.args.length ||
    proposition.values.length !== fact.values.length
  ) {
    return null;
  }

  for (let i = 0; i < proposition.args.length; i++) {
    const candidate = match(substitution, proposition.args[i], fact.args[i]);
    if (candidate === null) return null;
    substitution = candidate;
  }

  for (let i = 0; i < proposition.values.length; i++) {
    const candidate = match(substitution, proposition.values[i], fact.values[i]);
    if (candidate === null) return null;
    substitution = candidate;
  }

  return substitution;
}

type Database = Fact[];

export function matchAll(
  substitution: Substitution,
  proposition: Proposition,
  db: Database,
): Substitution[] {
  return db
    .map((data) => matchFact(substitution, proposition, data))
    .filter((x): x is Substitution => x !== null);
}

function check(fact: Fact, db: Database): 'redundant' | 'contradictory' | 'new' {
  for (const { name, args, values } of db) {
    if (
      fact.name === name &&
      fact.args.length === args.length &&
      fact.values.length === values.length &&
      fact.args.every((arg, i) => eqData(arg, args[i]))
    ) {
      return fact.values.every((val, i) => eqData(val, values[i])) ? 'redundant' : 'contradictory';
    }
  }
  return 'new';
}

funct