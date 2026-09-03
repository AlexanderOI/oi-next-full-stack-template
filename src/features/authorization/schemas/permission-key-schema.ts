import { z } from "zod";

import { permissionKeys } from "../constants/permission-catalog";
import type { PermissionKey } from "../interfaces/permission";

export const permissionKeySchema = z.enum(permissionKeys as [PermissionKey, ...PermissionKey[]]);
