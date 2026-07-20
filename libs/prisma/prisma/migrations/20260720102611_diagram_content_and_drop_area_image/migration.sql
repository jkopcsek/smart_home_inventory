-- DropIndex
DROP INDEX "AreaImage_areaId_idx";

-- DropIndex
DROP INDEX "AreaImage_imageAttachmentId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AreaImage";
PRAGMA foreign_keys=on;

-- RedefineTables
-- Diagram.source (Mermaid text) is replaced by Diagram.content (ng-diagram JSON model);
-- existing rows have no meaningful content, so they're reset to an empty diagram.
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
    CONSTRAINT "Diagram_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Diagram_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Diagram" ("areaId", "content", "createdAt", "deviceId", "id", "title", "updatedAt")
SELECT "areaId", '{"schemaVersion":1,"nodes":[],"edges":[]}', "createdAt", "deviceId", "id", "title", "updatedAt" FROM "Diagram";
DROP TABLE "Diagram";
ALTER TABLE "new_Diagram" RENAME TO "Diagram";
CREATE INDEX "Diagram_deviceId_idx" ON "Diagram"("deviceId");
CREATE INDEX "Diagram_areaId_idx" ON "Diagram"("areaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
