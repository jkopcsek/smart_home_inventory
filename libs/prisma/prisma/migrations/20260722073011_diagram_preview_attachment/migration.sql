-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Diagram" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deviceId" TEXT,
    "areaId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "previewAttachmentId" TEXT,
    CONSTRAINT "Diagram_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Diagram_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Diagram_previewAttachmentId_fkey" FOREIGN KEY ("previewAttachmentId") REFERENCES "Attachment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Diagram" ("areaId", "content", "createdAt", "deviceId", "id", "title", "updatedAt", "version") SELECT "areaId", "content", "createdAt", "deviceId", "id", "title", "updatedAt", "version" FROM "Diagram";
DROP TABLE "Diagram";
ALTER TABLE "new_Diagram" RENAME TO "Diagram";
CREATE UNIQUE INDEX "Diagram_previewAttachmentId_key" ON "Diagram"("previewAttachmentId");
CREATE INDEX "Diagram_deviceId_idx" ON "Diagram"("deviceId");
CREATE INDEX "Diagram_areaId_idx" ON "Diagram"("areaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
