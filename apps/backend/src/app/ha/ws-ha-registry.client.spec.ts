import { assertCommandAllowed } from './ws-ha-registry.client';

describe('assertCommandAllowed (read-only guard)', () => {
  it('allows registry reads in read-only mode', () => {
    expect(() =>
      assertCommandAllowed('config/area_registry/list', true)
    ).not.toThrow();
    expect(() =>
      assertCommandAllowed('config/device_registry/list', true)
    ).not.toThrow();
  });

  it('blocks write commands in read-only mode', () => {
    expect(() => assertCommandAllowed('call_service', true)).toThrow(/read-only/);
    expect(() =>
      assertCommandAllowed('config/area_registry/create', true)
    ).toThrow(/read-only/);
    expect(() =>
      assertCommandAllowed('config/device_registry/update', true)
    ).toThrow(/read-only/);
  });

  it('allows everything when read-only is off', () => {
    expect(() => assertCommandAllowed('call_service', false)).not.toThrow();
  });
});
