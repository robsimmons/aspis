import { Fact, matchFact } from './datalog';
import { Data } from './terms';

test('Fact matching: propositional', () => {
  const a: Fact = { type: 'Fact', name: 'a', args: [], values: [] };
  const b: Fact = { type: 'Fact', name: 'b', args: [], values: [] };

  expect(matchFact({}, { name: 'a', args: [], values: [] }, a)).toEqual({});
  expect(matchFact({}, { name: 'a', args: [], values: [] }, b)).toEqual(null);
  expect(
    matchFact({ X: { type: 'int', value: 4 } }, { name: 'a', args: [], values: [] }, a),
  ).toEqual({ X: { type: 'int', value: 4 } });
});

test('Fact matching: first order', () => {
  const s: Data = { type: 'string', value: 's' };
  const t: Data = { type: 'string', value: 't' };
  const a: Fact = { type: 'Fact', name: 'a', args: [t], values: [] };
  //const b: Fact = { name: 'b', args: [t, t], values: [] };
  //const c: Fact = { name: 'c', args: [], values: [t] };

  expect(matchFact({}, { name: 'a', args: [{ type: 'var', name: 'X' }], values: [] }, a)).toEqual({
    X: t,
  });
  expect(
    matchFact({ X: t }, { name: 'a', args: [{ type: 'var', name: 'X' }], values: [] }, a),
  ).toEqual({
    X: t,
  });
  expect(
    matchFact({ X: s }, { name: 'a', args: [{ type: 'var', name: 'X' }], values: [] }, a),
  ).toEqual(null);
});
