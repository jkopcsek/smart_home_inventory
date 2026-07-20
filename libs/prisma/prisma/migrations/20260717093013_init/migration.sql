-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "floor" TEXT,
    "notes" TEXT,
    "haAreaId" TEXT,
    "haName" TEXT,
    "haOrphaned" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "purchaseDate" DATETIME,
    "purchasePriceCents" INTEGER,
    "purchaseCurrency" TEXT DEFAULT 'EUR',
    "purchasedFrom" TEXT,
    "productUrl" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'installed',
    "areaId" TEXT,
    "haDeviceId" TEXT,
    "haName" TEXT,
    "haAreaIdAtSync" TEXT,
    "haOrphaned" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "primaryImageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Device_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Device_primaryImageId_fkey" FOREIGN KEY ("primaryImageId") REFERENCES "Attachment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "title" TEXT,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "deviceId" TEXT,
    "areaId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CapabilityType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "isSystem" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "DeviceCapability" (
    "deviceId" TEXT NOT NULL,
    "capabilityTypeId" TEXT NOT NULL,
    "metadata" JSONB,
    "notes" TEXT,

    PRIMARY KEY ("deviceId", "capabilityTypeId"),
    CONSTRAINT "DeviceCapability_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeviceCapability_capabilityTypeId_fkey" FOREIGN KEY ("capabilityTypeId") REFERENCES "CapabilityType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "fromDeviceId" TEXT NOT NULL,
    "toDeviceId" TEXT NOT NULL,
    "label" TEXT,
    "metadata" JSONB,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Connection_fromDeviceId_fkey" FOREIGN KEY ("fromDeviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Connection_toDeviceId_fkey" FOREIGN KEY ("toDeviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AreaImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "areaId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Plan',
    "description" TEXT,
    "imageAttachmentId" TEXT,
    "imageWidth" INTEGER,
    "imageHeight" INTEGER,
    "annotations" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AreaImage_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AreaImage_imageAttachmentId_fkey" FOREIGN KEY ("imageAttachmentId") REFERENCES "Attachment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Diagram" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "deviceId" TEXT,
    "areaId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Diagram_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Diagram_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Area_haAreaId_key" ON "Area"("haAreaId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_haDeviceId_key" ON "Device"("haDeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_primaryImageId_key" ON "Device"("primaryImageId");

-- CreateIndex
CREATE INDEX "Device_areaId_idx" ON "Device"("areaId");

-- CreateIndex
CREATE INDEX "Device_status_idx" ON "Device"("status");

-- CreateIndex
CREATE INDEX "Device_category_idx" ON "Device"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_storedName_key" ON "Attachment"("storedName");

-- CreateIndex
CREATE INDEX "Attachment_deviceId_idx" ON "Attachment"("deviceId");

-- CreateIndex
CREATE INDEX "Attachment_areaId_idx" ON "Attachment"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "CapabilityType_key_key" ON "CapabilityType"("key");

-- CreateIndex
CREATE INDEX "Connection_fromDeviceId_idx" ON "Connection"("fromDeviceId");

-- CreateIndex
CREATE INDEX "Connection_toDeviceId_idx" ON "Connection"("toDeviceId");

-- CreateIndex
CREATE INDEX "Connection_type_idx" ON "Connection"("type");

-- CreateIndex
CREATE UNIQUE INDEX "AreaImage_imageAttachmentId_key" ON "AreaImage"("imageAttachmentId");

-- CreateIndex
CREATE INDEX "AreaImage_areaId_idx" ON "AreaImage"("areaId");

-- CreateIndex
CREATE INDEX "Diagram_deviceId_idx" ON "Diagram"("deviceId");

-- CreateIndex
CREATE INDEX "Diagram_areaId_idx" ON "Diagram"("areaId");
