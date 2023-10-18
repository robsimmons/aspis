import { Pattern, freeVars } from './terms';

export interface Proposition {
  type: 'Proposition';
  name: string;
  args: Pattern[];
}

export interface Equality {
  type: 'Equality';
  a: Pattern;
  b: Pattern;
}

export interface Inequality {
  type: 'Inequality';
  a: Pattern;
  b: Pattern;
}

export type Premise = Proposition | Equality | Inequality;

export interface Conclusion {
  name: string;
  args: Pattern[];
  values: Pattern[];
  exhaustive: boolean;
}

export type Declaration =
  | { type: 'Constraint'; premises: (Proposition | Inequality)[] }
  | { type: 'Rule'; premises: (Proposition | Inequality)[]; conclusion: Conclusion };

function checkPremises(premises: Premise[]): { fv: Set<string>; errors: string[] } {
  const knownFreeVars = new Set<string>();
  const errors: string[] = [];
  for (let premise of premises) {
    switch (premise.type) {
      case 'Inequality': {
        const fv = freeVars(premise.a, premise.b);
        for (const v of fv) {
          if (!knownFreeVars.has(v)) {
            errors.push(`Variable '${v}' not defined before being used in an inequality.`);
          }
        }
        break;
      }
      case 'Equality': {
        const fvA = freeVars(premise.a);
        const fvB = freeVars(premise.b);
        for (const v of fvA) {
          if (!knownFreeVars.has(v)) {
            errors.push(
              `The left side of an equality premise must include only previously ground variables`,
            );
          }
        }
        for (const v of fvB) {
          knownFreeVars.add(v);
        }
        break;
      }
      case 'Proposition':
        const fv = freeVars(...premise.args);
        for (const v of fv) {
          knownFreeVars.add(v);
        }
        break;
    }
  }

  return { fv: knownFreeVars, errors };
}

export function checkDecl(decl: Declaration) {
  const { fv, errors } = checkPremises(decl.premises);
  switch (decl.type) {
    case 'Rule':
      const headVars = freeVars(...decl.conclusion.args, ...decl.conclusion.values);
      for (const v of headVars) {
        if (!fv.has(v)) {
          errors.push(`Variable '${v}' used in head of rule but not defined in a premise.`);
        }
      }
      break;
    case 'Constraint':
      break;
  }
  return errors;
}
