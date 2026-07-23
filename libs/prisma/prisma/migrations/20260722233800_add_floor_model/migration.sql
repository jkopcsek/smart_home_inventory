-- CreateTable
CREATE TABLE "Floor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "level" INTEGER,
    "haFloorId" TEXT,
    "haName" TEXT,
    "haOrphaned" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Floor_haFloorId_key" ON "Floor"("haFloorId");

-- Backfill: one manual Floor row per distinct existing Area.floor text value,
-- so areas keep their floor after `floor` (string) becomes `floorId` (relation).
INSERT INTO "Floor" ("id", "name", "source", "createdAt", "updatedAt")
SELECT
    'flr_' || lower(hex(randomblob(12))),
    "floor",
    'manual',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Area"
WHERE "floor" IS NOT NULL
GROUP BY "floor";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Area" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "floorId" TEXT,
    "notes" TEXT,
    "haAreaId" TEXT,
    "haName" TEXT,
    "haFloorIdAtSync" TEXT,
    "haOrphaned" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Area_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Area" ("id", "name", "floorId", "notes", "haAreaId", "haName", "haOrphaned", "source", "createdAt", "updatedAt")
SELECT a."id", a."name", f."id", a."notes", a."haAreaId", a."haName", a."haOrphaned", a."source", a."createdAt", a."updatedAt"
FROM "Area" a
LEFT JOIN "Floor" f ON f."name" = a."floor";
DROP TABLE "Area";
ALTER TABLE "new_Area" RENAME TO "Area";
CREATE UNIQUE INDEX "Area_haAreaId_key" ON "Area"("haAreaId");
CREATE INDEX "Area_floorId_idx" ON "Area"("floorId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
