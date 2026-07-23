import { HttpClient, HttpEvent, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AreaDto,
  AttachmentDto,
  AttachmentKind,
  CapabilityTypeDto,
  ConnectionDto,
  CreateAreaDto,
  CreateCapabilityTypeDto,
  CreateConnectionDto,
  CreateDeviceDto,
  CreateDiagramDto,
  CreateFloorDto,
  DeviceCapabilityDto,
  DeviceDetailDto,
  DeviceDto,
  DeviceQueryDto,
  DiagramContent,
  DiagramDto,
  FloorDto,
  HaStatusDto,
  SetDeviceCapabilityDto,
  SyncResultDto,
  UpdateAreaDto,
  UpdateCapabilityTypeDto,
  UpdateConnectionDto,
  UpdateDeviceDto,
  UpdateDiagramDto,
  UpdateFloorDto,
} from '@smart-home-inventory/shared';

function params(obj: Record<string, string | undefined>): HttpParams {
  let p = new HttpParams();
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== '') p = p.set(key, value);
  }
  return p;
}

/** Relative URL for an attachment, usable directly in <img src> / <a href>. */
export function attachmentUrl(id: string, inline = true): string {
  return `api/attachments/${id}/download${inline ? '?inline=1' : ''}`;
}

@Injectable({ providedIn: 'root' })
export class FloorsApi {
  private readonly http = inject(HttpClient);

  list(): Observable<FloorDto[]> {
    return this.http.get<FloorDto[]>('api/floors');
  }
  create(dto: CreateFloorDto): Observable<FloorDto> {
    return this.http.post<FloorDto>('api/floors', dto);
  }
  update(id: string, dto: UpdateFloorDto): Observable<FloorDto> {
    return this.http.patch<FloorDto>(`api/floors/${id}`, dto);
  }
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`api/floors/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class AreasApi {
  private readonly http = inject(HttpClient);

  list(q?: { q?: string; floorId?: string }): Observable<AreaDto[]> {
    return this.http.get<AreaDto[]>('api/areas', { params: params(q ?? {}) });
  }
  get(id: string): Observable<AreaDto> {
    return this.http.get<AreaDto>(`api/areas/${id}`);
  }
  create(dto: CreateAreaDto): Observable<AreaDto> {
    return this.http.post<AreaDto>('api/areas', dto);
  }
  update(id: string, dto: UpdateAreaDto): Observable<AreaDto> {
    return this.http.patch<AreaDto>(`api/areas/${id}`, dto);
  }
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`api/areas/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class DevicesApi {
  private readonly http = inject(HttpClient);

  list(q?: DeviceQueryDto): Observable<DeviceDto[]> {
    return this.http.get<DeviceDto[]>('api/devices', {
      params: params((q ?? {}) as Record<string, string | undefined>),
    });
  }
  get(id: string): Observable<DeviceDetailDto> {
    return this.http.get<DeviceDetailDto>(`api/devices/${id}`);
  }
  create(dto: CreateDeviceDto): Observable<DeviceDetailDto> {
    return this.http.post<DeviceDetailDto>('api/devices', dto);
  }
  update(id: string, dto: UpdateDeviceDto): Observable<DeviceDetailDto> {
    return this.http.patch<DeviceDetailDto>(`api/devices/${id}`, dto);
  }
  setPrimaryImage(id: string, attachmentId: string | null): Observable<DeviceDetailDto> {
    return this.http.put<DeviceDetailDto>(`api/devices/${id}/primary-image`, {
      attachmentId,
    });
  }
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`api/devices/${id}`);
  }
}

export type AttachmentOwner = { deviceId: string } | { areaId: string } | { home: true };

function ownerAttachmentsUrl(owner: AttachmentOwner): string {
  if ('deviceId' in owner) return `api/devices/${owner.deviceId}/attachments`;
  if ('areaId' in owner) return `api/areas/${owner.areaId}/attachments`;
  return 'api/home/attachments';
}

@Injectable({ providedIn: 'root' })
export class AttachmentsApi {
  private readonly http = inject(HttpClient);

  listForOwner(owner: AttachmentOwner): Observable<AttachmentDto[]> {
    return this.http.get<AttachmentDto[]>(ownerAttachmentsUrl(owner));
  }
  get(id: string): Observable<AttachmentDto> {
    return this.http.get<AttachmentDto>(`api/attachments/${id}`);
  }
  upload(
    owner: AttachmentOwner,
    file: File,
    kind: AttachmentKind,
    title?: string
  ): Observable<HttpEvent<AttachmentDto>> {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    if (title) form.append('title', title);
    return this.http.post<AttachmentDto>(ownerAttachmentsUrl(owner), form, {
      reportProgress: true,
      observe: 'events',
    });
  }
  update(
    id: string,
    dto: { kind?: AttachmentKind; title?: string | null }
  ): Observable<AttachmentDto> {
    return this.http.patch<AttachmentDto>(`api/attachments/${id}`, dto);
  }
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`api/attachments/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class CapabilitiesApi {
  private readonly http = inject(HttpClient);

  listTypes(): Observable<CapabilityTypeDto[]> {
    return this.http.get<CapabilityTypeDto[]>('api/capability-types');
  }
  createType(dto: CreateCapabilityTypeDto): Observable<CapabilityTypeDto> {
    return this.http.post<CapabilityTypeDto>('api/capability-types', dto);
  }
  updateType(id: string, dto: UpdateCapabilityTypeDto): Observable<CapabilityTypeDto> {
    return this.http.patch<CapabilityTypeDto>(`api/capability-types/${id}`, dto);
  }
  removeType(id: string): Observable<void> {
    return this.http.delete<void>(`api/capability-types/${id}`);
  }
  setForDevice(
    deviceId: string,
    key: string,
    dto: SetDeviceCapabilityDto = {}
  ): Observable<DeviceCapabilityDto> {
    return this.http.put<DeviceCapabilityDto>(
      `api/devices/${deviceId}/capabilities/${key}`,
      dto
    );
  }
  removeForDevice(deviceId: string, key: string): Observable<void> {
    return this.http.delete<void>(`api/devices/${deviceId}/capabilities/${key}`);
  }
}

@Injectable({ providedIn: 'root' })
export class ConnectionsApi {
  private readonly http = inject(HttpClient);

  list(q?: {
    deviceId?: string;
    areaId?: string;
    type?: string;
  }): Observable<ConnectionDto[]> {
    return this.http.get<ConnectionDto[]>('api/connections', {
      params: params(q ?? {}),
    });
  }
  create(dto: CreateConnectionDto): Observable<ConnectionDto> {
    return this.http.post<ConnectionDto>('api/connections', dto);
  }
  update(id: string, dto: UpdateConnectionDto): Observable<ConnectionDto> {
    return this.http.patch<ConnectionDto>(`api/connections/${id}`, dto);
  }
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`api/connections/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class DiagramsApi {
  private readonly http = inject(HttpClient);

  list(q?: {
    deviceId?: string;
    areaId?: string;
    standalone?: '1';
  }): Observable<DiagramDto[]> {
    return this.http.get<DiagramDto[]>('api/diagrams', { params: params(q ?? {}) });
  }
  get(id: string): Observable<DiagramDto> {
    return this.http.get<DiagramDto>(`api/diagrams/${id}`);
  }
  create(dto: CreateDiagramDto): Observable<DiagramDto> {
    return this.http.post<DiagramDto>('api/diagrams', dto);
  }
  update(id: string, dto: UpdateDiagramDto): Observable<DiagramDto> {
    return this.http.patch<DiagramDto>(`api/diagrams/${id}`, dto);
  }
  putContent(id: string, version: number, content: DiagramContent): Observable<DiagramDto> {
    return this.http.put<DiagramDto>(`api/diagrams/${id}/content`, { version, content });
  }
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`api/diagrams/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class HaApi {
  private readonly http = inject(HttpClient);

  sync(): Observable<SyncResultDto> {
    return this.http.post<SyncResultDto>('api/ha/sync', {});
  }
  status(): Observable<HaStatusDto> {
    return this.http.get<HaStatusDto>('api/ha/status');
  }
}
