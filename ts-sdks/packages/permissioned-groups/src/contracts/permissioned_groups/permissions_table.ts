/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/

/**
 * Module: permissions_table
 *
 * Internal data structure for storing member permissions. Maps
 * `address -> VecSet<TypeName>` using dynamic fields on a derived object. Created
 * as a child of `PermissionedGroup` for easy discoverability.
 */

import { MoveStruct } from '../utils/index.js';
import { bcs } from '@mysten/sui/bcs';
const $moduleName = '@local-pkg/permissioned-groups::permissions_table';
export const PermissionsTable = new MoveStruct({
	name: `${$moduleName}::PermissionsTable`,
	fields: {
		id: bcs.Address,
		length: bcs.u64(),
	},
});
