import { Substitution, Pattern, Data, match } from './terms';

type Proposition = { name: string; args: Pattern[]; values: Pattern[] };

type Fact = { name: string; args: Data[]; values: Data[] };


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

function matchAll(
  substitution: Substitution,
  proposition: Proposition,
  db: Database,
): Substitution[] {
  return db
    .map((data) => matchFact(substitution, proposition, data))
    .filter((x): x is Substitution => x !== null);
}
