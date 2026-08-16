ALTER TABLE "permission" ADD COLUMN "name" text;
UPDATE "permission"
SET "name" = CASE "key"
	WHEN 'profile.read.own' THEN 'View own profile'
	WHEN 'profile.update.own' THEN 'Update own profile'
	WHEN 'authorization.roles.read' THEN 'View roles'
	WHEN 'authorization.roles.create' THEN 'Create roles'
	WHEN 'authorization.roles.update' THEN 'Update roles'
	WHEN 'authorization.roles.delete' THEN 'Delete roles'
	WHEN 'authorization.users.read' THEN 'View users'
	WHEN 'authorization.user-roles.update' THEN 'Manage user roles'
	WHEN 'authorization.audit.read' THEN 'View authorization audit'
	ELSE "key"
END;
ALTER TABLE "permission" ALTER COLUMN "name" SET NOT NULL;
