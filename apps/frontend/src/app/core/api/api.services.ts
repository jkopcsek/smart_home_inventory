import { HttpClient, HttpEvent, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AreaDto,
  AreaImageDto,
  AttachmentDto,
  AttachmentKind,
  CapabilityTypeDto,
  ConnectionDto,
  CreateAreaDto,
  CreateAreaImageDto,
  CreateCapabilityTypeDto,
  CreateConnectionDto,
  CreateDeviceDto,
  CreateDiagramDto,
  DeviceCapabilityDto,
  DeviceDetailDto,
  DeviceDto,
  DeviceQueryDto,
  DiagramDto,
  HaStatusDto,
  PlanAnnotations,
  SetDeviceCapabilityDto,
  SyncResultDto,
  UpdateAreaDto,
  UpdateAreaImageDto,
  UpdateCapabilityTypeDto,
  UpdateConnectionDto,
  UpdateDeviceDto,
  UpdateDiagramDto,
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
export class AreasApi {
  private readonly http = inject(HttpClient);

  list(q?: { q?: string; floor?: string }): Observable<AreaDto[]> {
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

@Injectable({ providedIn: 'root' })
export class AttachmentsApi {
  private readonly http = inject(HttpClient);

  upload(
    owner: { deviceId: string } | { areaId: string },
    file: File,
    kind: AttachmentKind,
    title?: string
  ): Observable<HttpEvent<AttachmentDto>> {
    const target =
      'deviceId' in owner
        ? `api/devices/${owner.deviceId}/attachments`
        : `api/areas/${owner.areaId}/attachments`;
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    if (title) form.append('title', title);
    return this.http.post<AttachmentDto>(target, form, {
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
export class AreaImagesApi {
  private readonly http = inject(HttpClient);

  listForArea(areaId: string): Observable<AreaImageDto[]> {
    return this.http.get<AreaImageDto[]>(`api/areas/${areaId}/images`);
  }
  get(id: string): Observable<AreaImageDto> {
    return this.http.get<AreaImageDto>(`api/area-images/${id}`);
  }
  create(
    areaId: string,
    dto: CreateAreaImageDto,
    file?: File
  ): Observable<AreaImageDto> {
    const form = new FormData();
    form.append('name', dto.name);
    if (dto.kind) form.append('kind', dto.kind);
    if (dto.description) form.append('description', dto.description);
    if (file) form.append('file', file);
    return this.http.post<AreaImageDto>(`api/areas/${areaId}/images`, form);
  }
  update(id: string, dto: UpdateAreaImageDto): Observable<AreaImageDto> {
    return this.http.patch<AreaImageDto>(`api/area-images/${id}`, dto);
  }
  replaceImage(id: string, file: File): Observable<AreaImageDto> {
    const form = new FormData();
    form.append('file', file);
    return this.http.put<AreaImageDto>(`api/area-images/${id}/image`, form);
  }
  putAnnotations(
    id: string,
    version: number,
    annotations: PlanAnnotations
  ): Observable<AreaImageDto> {
    return this.http.put<AreaImageDto>(`api/area-images/${id}/annotations`, {
      version,
      annotations,
    });
  }
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`api/area-images/${id}`);
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
