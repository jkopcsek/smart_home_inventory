import axios from 'axios';

describe('smart home inventory API (real server, temp DB)', () => {
  it('reports healthy with a writable data dir', async () => {
    const res = await axios.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ status: 'ok', db: true, dataDirWritable: true });
  });

  it('runs the core area → device → connection flow', async () => {
    const area = (
      await axios.post('/api/areas', { name: 'Werkstatt', floor: 'UG' })
    ).data;
    expect(area.source).toBe('manual');

    const device = (
      await axios.post('/api/devices', {
        name: 'Shelly 1PM',
        category: 'switch_actor',
        areaId: area.id,
      })
    ).data;
    expect(device.areaName).toBe('Werkstatt');

    const breaker = (
      await axios.post('/api/devices', { name: 'F3', category: 'breaker' })
    ).data;
    const connection = (
      await axios.post('/api/connections', {
        type: 'electrical',
        fromDeviceId: breaker.id,
        toDeviceId: device.id,
        label: 'L1 / F3',
      })
    ).data;
    expect(connection.fromDeviceName).toBe('F3');

    // Deleting the breaker cascades the connection.
    await axios.delete(`/api/devices/${breaker.id}`);
    const remaining = (
      await axios.get('/api/connections', { params: { deviceId: device.id } })
    ).data;
    expect(remaining).toHaveLength(0);
  });

  it('rejects invalid payloads with issue details', async () => {
    const res = await axios.post(
      '/api/devices',
      { name: '', status: 'nonsense' },
      { validateStatus: () => true }
    );
    expect(res.status).toBe(400);
    expect(res.data.issues?.length).toBeGreaterThan(0);
  });

  it('syncs the mock HA registry idempotently', async () => {
    const first = (await axios.post('/api/ha/sync')).data;
    expect(first.areas.created).toBeGreaterThan(0);
    const second = (await axios.post('/api/ha/sync')).data;
    expect(second.areas.created).toBe(0);
    expect(second.devices.created).toBe(0);
  });

  it('keeps a local rename through subsequent syncs', async () => {
    const areas = (await axios.get('/api/areas')).data;
    const synced = areas.find((a: { haAreaId: string | null }) => a.haAreaId);
    expect(synced).toBeDefined();
    await axios.patch(`/api/areas/${synced.id}`, { name: 'Mein Umbenannt' });
    await axios.post('/api/ha/sync');
    const after = (await axios.get(`/api/areas/${synced.id}`)).data;
    expect(after.name).toBe('Mein Umbenannt');
  });

  it('enforces optimistic locking on diagram content', async () => {
    const area = (await axios.post('/api/areas', { name: 'Plan-Test' })).data;
    const diagram = (
      await axios.post('/api/diagrams', { title: 'Fuse box', areaId: area.id })
    ).data;
    expect(diagram.version).toBe(1);

    const content = {
      schemaVersion: 1,
      nodes: [
        {
          id: 'n1',
          position: { x: 0, y: 0 },
          data: { shape: 'box', label: 'Breaker' },
        },
      ],
      edges: [],
    };
    const saved = (
      await axios.put(`/api/diagrams/${diagram.id}/content`, {
        version: 1,
        content,
      })
    ).data;
    expect(saved.version).toBe(2);

    const stale = await axios.put(
      `/api/diagrams/${diagram.id}/content`,
      { version: 1, content },
      { validateStatus: () => true }
    );
    expect(stale.status).toBe(409);
  });

  it('refuses to delete in-use or system capability types', async () => {
    const types = (await axios.get('/api/capability-types')).data;
    const system = types.find((t: { isSystem: boolean }) => t.isSystem);
    const res = await axios.delete(`/api/capability-types/${system.id}`, {
      validateStatus: () => true,
    });
    expect(res.status).toBe(409);
  });
});
