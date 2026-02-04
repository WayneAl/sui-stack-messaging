// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { BcsType } from '@mysten/bcs';

import type { PermissionedGroupsPackageConfig } from './types.js';

import {
	Administrator,
	ExtensionPermissionsManager,
	GroupCreated,
	GroupDerived,
	MemberAdded,
	MemberRemoved,
	PermissionedGroup,
	PermissionsGranted,
	PermissionsRevoked,
} from './contracts/permissioned_groups/permissioned_group.js';

export type ParsedPermissionedGroup = (typeof PermissionedGroup)['$inferType'];
export type ParsedAdministrator = (typeof Administrator)['$inferType'];
export type ParsedExtensionPermissionsManager = (typeof ExtensionPermissionsManager)['$inferType'];
export type ParsedGroupCreated = (typeof GroupCreated)['$inferType'];
export type ParsedGroupDerived<DerivationKey = unknown> = {
	group_id: string;
	creator: string;
	parent_id: string;
	derivation_key: DerivationKey;
};
export type ParsedMemberAdded = (typeof MemberAdded)['$inferType'];
export type ParsedMemberRemoved = (typeof MemberRemoved)['$inferType'];
export type ParsedPermissionsGranted = (typeof PermissionsGranted)['$inferType'];
export type ParsedPermissionsRevoked = (typeof PermissionsRevoked)['$inferType'];

export interface PermissionedGroupsBCSOptions {
	packageConfig: PermissionedGroupsPackageConfig;
	witnessType: string;
}

/**
 * BCS type definitions for the permissioned-groups package.
 *
 * Each instance creates transformed copies of the generated BCS types
 * with the correct package ID in the type name, ensuring multiple SDK
 * instances with different package configurations don't interfere.
 *
 * @example
 * ```ts
 * const bcs = new PermissionedGroupsBCS({
 *   packageConfig: { packageId: '0x123...' }
 * });
 *
 * const group = bcs.PermissionedGroup.parse(permissionedGroupObject.content);
 * ```
 */
export class PermissionedGroupsBCS {
	/** Core permission type: super-admin role */
	readonly Administrator: BcsType<ParsedAdministrator, unknown>;
	/** Core permission type: can manage extension permissions */
	readonly ExtensionPermissionsManager: BcsType<ParsedExtensionPermissionsManager, unknown>;
	/** Main group struct containing membership and permission data */
	readonly PermissionedGroup: BcsType<ParsedPermissionedGroup, unknown>;
	/** Event emitted when a group is created */
	readonly GroupCreated: BcsType<ParsedGroupCreated, unknown>;
	/** Event emitted when a member is added to a group */
	readonly MemberAdded: BcsType<ParsedMemberAdded, unknown>;
	/** Event emitted when a member is removed from a group */
	readonly MemberRemoved: BcsType<ParsedMemberRemoved, unknown>;
	/** Event emitted when permissions are granted to a member */
	readonly PermissionsGranted: BcsType<ParsedPermissionsGranted, unknown>;
	/** Event emitted when permissions are revoked from a member */
	readonly PermissionsRevoked: BcsType<ParsedPermissionsRevoked, unknown>;

	readonly #moduleName: string;
	readonly #witnessType: string;

	constructor(options: PermissionedGroupsBCSOptions) {
		const moduleName = `${options.packageConfig.packageId}::permissioned_group`;
		this.#moduleName = moduleName;
		this.#witnessType = options.witnessType;

		this.Administrator = Administrator.transform({
			name: `${moduleName}::Administrator`,
		});
		this.ExtensionPermissionsManager = ExtensionPermissionsManager.transform({
			name: `${moduleName}::ExtensionPermissionsManager`,
		});
		this.PermissionedGroup = PermissionedGroup.transform({
			name: `${moduleName}::PermissionedGroup<${options.witnessType}>`,
		});
		this.GroupCreated = GroupCreated.transform({
			name: `${moduleName}::GroupCreated<${options.witnessType}>`,
		});
		this.MemberAdded = MemberAdded.transform({
			name: `${moduleName}::MemberAdded<${options.witnessType}>`,
		});
		this.MemberRemoved = MemberRemoved.transform({
			name: `${moduleName}::MemberRemoved<${options.witnessType}>`,
		});
		this.PermissionsGranted = PermissionsGranted.transform({
			name: `${moduleName}::PermissionsGranted<${options.witnessType}>`,
		});
		this.PermissionsRevoked = PermissionsRevoked.transform({
			name: `${moduleName}::PermissionsRevoked<${options.witnessType}>`,
		});
	}

	/** Event emitted when a group is derived from a parent object */
	GroupDerived<DerivationKey extends BcsType<any>>(
		derivationKeyType: DerivationKey,
	): BcsType<ParsedGroupDerived<DerivationKey['$inferType']>, unknown> {
		return GroupDerived(derivationKeyType).transform({
			name: `${this.#moduleName}::GroupDerived<${this.#witnessType}, ${derivationKeyType.name}>`,
		});
	}
}
