import { CONNECTION_TYPE_GROUPS, CONNECTION_TYPES_ORDERED } from './connection-colors';
import { CONNECTION_TYPES } from './enums';

describe('CONNECTION_TYPE_GROUPS', () => {
  it('covers every ConnectionType exactly once', () => {
    const flattened = CONNECTION_TYPE_GROUPS.flatMap((g) => g.types);
    expect(new Set(flattened).size).toBe(flattened.length);
    expect(flattened.sort()).toEqual([...CONNECTION_TYPES].sort());
  });

  it('CONNECTION_TYPES_ORDERED matches the grouped flattening', () => {
    expect(CONNECTION_TYPES_ORDERED).toEqual(CONNECTION_TYPE_GROUPS.flatMap((g) => g.types));
  });
});
