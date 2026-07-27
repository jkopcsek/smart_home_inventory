-- ConnectionType's generic "electrical" value is replaced by specific
-- cable/voltage variants (mains_230v, dc_24v, dc_12v) plus a new "usb" value —
-- the same granularity is now reused in diagram wire/port typing. The `type`
-- column is plain TEXT (no DB-level enum constraint), so this is a data-only
-- backfill; existing "electrical" connections become "mains_230v" (the most
-- common case) and can be corrected individually if that guess is wrong.
UPDATE "Connection" SET "type" = 'mains_230v' WHERE "type" = 'electrical';
