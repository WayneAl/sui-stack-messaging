// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { PermissionedGroupsPackageConfig } from './types.js';

export const TESTNET_PERMISSIONED_GROUPS_PACKAGE_CONFIG = {
	packageId: '0xTBD',
} satisfies PermissionedGroupsPackageConfig;

export const MAINNET_PERMISSIONED_GROUPS_PACKAGE_CONFIG = {
	packageId: '0xTBD',
} satisfies PermissionedGroupsPackageConfig;

/**
 * The derivation key used to derive the PermissionsTable from a PermissionedGroup.
 * Must match the Move constant `PERMISSIONS_TABLE_DERIVATION_KEY_BYTES` in `permissioned_group.move`.
 */
export const PERMISSIONS_TABLE_DERIVATION_KEY = 'permissions_table';
