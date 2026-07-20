import {
  Attachment,
  CapabilityType,
  Connection,
  DeviceCapability,
} from '@smart-home-inventory/prisma';
import {
  AttachmentDto,
  AttachmentKind,
  CapabilityCategory,
  ConnectionDto,
  ConnectionType,
  DeviceCapabilityDto,
} from '@smart-home-inventory/shared';

export function toAttachmentDto(a: Attachment): AttachmentDto {
  return {
    id: a.id,
    kind: a.kind as AttachmentKind,
    title: a.title,
    originalName: a.originalName,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    deviceId: a.deviceId,
    areaId: a.areaId,
    createdAt: a.createdAt.toISOString(),
  };
}

export function toDeviceCapabilityDto(
  link: DeviceCapability & { capabilityType: CapabilityType }
): DeviceCapabilityDto {
  return {
    capabilityTypeId: link.capabilityTypeId,
    key: link.capabilityType.key,
    label: link.capabilityType.label,
    category: link.capabilityType.category as CapabilityCategory,
    metadata: (link.metadata as Record<string, unknown> | null) ?? null,
    notes: link.notes,
  };
}

export function toConnectionDto(
  c: Connection & {
    fromDevice: { name: string };
    toDevice: { name: string };
  }
): ConnectionDto {
  return {
    id: c.id,
    type: c.type as ConnectionType,
    fromDeviceId: c.fromDeviceId,
    fromDeviceName: c.fromDevice.name,
    toDeviceId: c.toDeviceId,
    toDeviceName: c.toDevice.name,
    label: c.label,
    metadata: (c.metadata as Record<string, unknown> | null) ?? null,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}
