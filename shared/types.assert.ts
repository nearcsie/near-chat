/**
 * Compile-time assertions for shared/types.ts invariants.
 * This file emits no runtime code — all checks are type-level only.
 */
import type { PublicUser, User, ServerToClientEvents, ApiError } from './types';

// PublicUser must NOT expose password or passwordHash
type _NoPassword = 'password' extends keyof PublicUser ? never : true;
type _NoPasswordHash = 'passwordHash' extends keyof PublicUser ? never : true;
const _assertNoPassword: _NoPassword = true;
const _assertNoPasswordHash: _NoPasswordHash = true;

// PublicUser must be a strict subset of User's public fields
type _PublicUserFields = keyof PublicUser;
type _UserHasPublicFields = _PublicUserFields extends keyof User ? true : never;
const _assertSubset: _UserHasPublicFields = true;

// ServerToClientEvents.error must accept ApiError
type _ErrorPayload = Parameters<ServerToClientEvents['error']>[0];
type _AssertErrorShape = _ErrorPayload extends ApiError ? true : never;
const _assertErrorShape: _AssertErrorShape = true;

// Suppress unused-variable warnings
void _assertNoPassword;
void _assertNoPasswordHash;
void _assertSubset;
void _assertErrorShape;
