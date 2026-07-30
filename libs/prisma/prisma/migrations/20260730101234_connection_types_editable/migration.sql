-- CreateTable
CREATE TABLE "ConnectionType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'other',
    "color" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false
);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectionType_key_key" ON "ConnectionType"("key");
