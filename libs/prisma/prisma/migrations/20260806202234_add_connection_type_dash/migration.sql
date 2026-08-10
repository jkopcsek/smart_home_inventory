-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ConnectionType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'other',
    "color" TEXT NOT NULL,
    "dash" TEXT NOT NULL DEFAULT 'solid',
    "isSystem" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_ConnectionType" ("color", "group", "id", "isSystem", "key", "label") SELECT "color", "group", "id", "isSystem", "key", "label" FROM "ConnectionType";
DROP TABLE "ConnectionType";
ALTER TABLE "new_ConnectionType" RENAME TO "ConnectionType";
CREATE UNIQUE INDEX "ConnectionType_key_key" ON "ConnectionType"("key");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
