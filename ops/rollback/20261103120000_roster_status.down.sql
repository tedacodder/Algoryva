-- Undo: removes the roster status. Pending checks are lost; valid entries stay on the list.
ALTER TABLE "GroupRoster" DROP COLUMN "status";
