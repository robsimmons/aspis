import { Substitution, Pattern, Data, match, apply, equal } from './terms';

export type Proposition = { name: string; args: Pattern[]; values: Pattern[] };
// type Rule = { premises: Proposition[]; conclusions: Proposition[][] };

export type InternalRule = {
  name: string;
  nextName: string[];
  independent: string[];
  shared: string[];
  new: string[];
  premise: Proposition;
};

export type InternalConclusion = {
  mutuallyExclusiveConclusions: Proposition[];
  exhaustive: boolean;
};

export interface Fact {
  type: 'Fact';
  name: string;
  args: Data[];
  values: Data[];
}

export interface PartialRule {
  type: 'PartialRule';
  name: string;
  args: Substitution;
}

export type DbItem = Fact | PartialRule;

export interface Database {
  facts: Fact[];
  partialRules: PartialRule[];
  uninteresting: Fact[];
  queue: DbItem[];
}

export function matchFact(
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

export function step(
  rules: InternalRule[],
  conclusions: { [name: string]: InternalConclusion },
  db: Database,
): Database[] {
  const newPartialRules: PartialRule[] = [];
  const [current, ...rest] = db.queue;
  db = { ...db, queue: rest };

  if (current.type === 'PartialRule' && conclusions[current.name]) {
    let redundantPossibilities = false;
    const dbs: Database[] = [];
    const conclusion = conclusions[current.name];
    for (const proposition of conclusion.mutuallyExclusiveConclusions) {
      const fact = applyProposition(current.args, proposition);
      const result = evaluateFactAgainstDatabase(db, fact);
      switch (result.type) {
        case 'inconsistent':
          break;
        case 'redundant':
          redundantPossibilities = true;
          break;
        case 'extend':
          dbs.push(result.db);
          break;
      }
    }
    if (redundantPossibilities) {
      dbs.push(db);
    }
    return dbs;
  }

  switch (current.type) {
    case 'Fact': {
      for (const rule of rules) {
        const substitution = matchFact({}, rule.premise, current);
        if (substitution !== null) {
          const shared = rule.shared.map((varName) => ({
            varName,
            value: substitution[varName],
          }));
          for (const item of db.partialRules) {
            if (
              item.name === rule.name &&
              shared.every(({ varName, value }) => equal(item.args[varName], value))
            ) {
              const extendedSubstitution = { ...substitution };
              for (const varName of rule.new) {
                extendedSubstitution[varName] = item.args[varName];
              }
              newPartialRules.push(
                ...rule.nextName.map<PartialRule>((next) => ({
                  type: 'PartialRule',
                  name: next,
                  args: extendedSubstitution,
                })),
              );
            }
          }
        }
      }
      break;
    }
    case 'PartialRule': {
      for (const rule of rules) {
        if (current.name === rule.name) {
          console.log(`Matched ${current.name}`);
          for (const item of db.facts) {
            if (item.name === rule.premise.name && item.args.length === rule.premise.args.length) {
              console.log(`Fact ${JSON.stringify(item)}`);
              const extendedSubstitution = matchFact(current.args, rule.premise, item);
              console.log(extendedSubstitution);
              if (extendedSubstitution !== null) {
                newPartialRules.push(
                  ...rule.nextName.map<PartialRule>((next) => ({
                    type: 'PartialRule',
                    name: next,
                    args: extendedSubstitution,
                  })),
                );
              }
            }
          }
        }
      }
    }
  }

  for (let newItem of newPartialRules) {
    console.log(newItem);
    if (
      !db.partialRules.some(
        (item) =>
          newItem.name === item.name &&
          Object.entries(item.args).every(([varName, data]) => equal(newItem.args[varName], data)),
      )
    ) {
      console.log('Item not in db already!');
      db.partialRules.push(newItem);
      db.queue.push(newItem);
    }
  }

  return [db];
}

export function evaluateFactAgainstDatabase(
  db: Database,
  newFact: Fact,
): { type: 'inconsistent' } | { type: 'redundant' } | { type: 'extend'; db: Database } {
  for (const fact of db.facts) {
    if (
      fact.name === newFact.name &&
      fact.args.length === newFact.args.length &&
      fact.values.length === newFact.args.length &&
      fact.args.every((arg, i) => equal(arg, newFact.args[i]))
    ) {
      return fact.values.every((value, i) => equal(value, newFact.values[i]))
        ? { type: 'redundant' }
        : { type: 'inconsistent' };
    }
  }

  for (const fact of db.uninteresting) {
    if (
      fact.name === newFact.name &&
      fact.args.length === newFact.args.length &&
      fact.values.length === newFact.args.length &&
      fact.args.every((arg, i) => equal(arg, newFact.args[i])) &&
      fact.values.every((arg, i) => equal(arg, newFact.values[i]))
    ) {
      return { type: 'redundant' };
    }
  }
  return {
    type: 'extend',
    db: {
      ...db,
      facts: [...db.facts, newFact],
      queue: [...db.queue, newFact],
    },
  };
}

export function applyProposition(substitution: Substitution, proposition: Proposition): Fact {
  return {
    type: 'Fact',
    name: proposition.name,
    args: proposition.args.map((arg) => apply(substitution, arg)),
    values: proposition.values.map((arg) => apply(substitution, arg)),
  };
}

/*




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


export function extendFacts(
  db: Database,
  newFacts: Fact[],
): { type: 'inconsistent' } | { type: 'redundant' } | { type: 'extend'; db: Database } {
  for (const newFact of newFacts) {
    const extension = extendFact(db, newFact);
    switch (extension.type) {
      case 'inconsistent':
        return { type: 'inconsistent' };
      case 'redundant':
        break;
      case 'extend':
        db = extension.db;
    }
  }
  return { type: 'extend', db };
}
*/

/*
export function applyRule(db: Database, rule: Rule) {
  let substs: Substitution[] = [{}];
  for (const premise of rule.premises) {
    substs = substs.flatMap((substitution) => matchAll(substitution, premise, db));
  }
  for (const substitution in substs) {

  }
}
*/
