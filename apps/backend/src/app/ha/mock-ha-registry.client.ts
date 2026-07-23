import { HaArea, HaDevice, HaFloor, HaRegistryClient } from './ha-registry.types';
import { FIXTURE_AREAS, FIXTURE_DEVICES, FIXTURE_FLOORS } from './fixtures/registry.fixtures';

/**
 * Offline development client returning a small realistic registry so the
 * whole app (including sync) works without a Home Assistant instance.
 */
export class MockHaRegistryClient implements HaRegistryClient {
  async listAreas(): Promise<HaArea[]> {
    return FIXTURE_AREAS;
  }

  async listDevices(): Promise<HaDevice[]> {
    return FIXTURE_DEVICES;
  }

  async listFloors(): Promise<HaFloor[]> {
    return FIXTURE_FLOORS;
  }

  async ping(): Promise<boolean> {
    return true;
  }
}
