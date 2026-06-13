/**
 * Compile-time assertions for shared/types.ts invariants.
 * This file emits no runtime code — all checks are type-level only.
 */
import type { PublicUser, User, ServerToClientEvents, ApiError } from './types';

// PublicUser must NOT expose password or passwordHash
type _NoPassword = 'password' extends keyof PublicUser ? never : true;
type _NoPasswordHash = 'passwordHash' extends keyof PublicUser ? never : true;
declare const _assertNoPassword: _NoPassword;
declare const _assertNoPasswordHash: _NoPasswordHash;

// PublicUser must be a strict subset of User's public fields
type _PublicUserFields = keyof PublicUser;
type _UserHasPublicFields = _PublicUserFields extends keyof User ? true : never;
declare const _assertSubset: _UserHasPublicFields;

// ServerToClientEvents.error must accept ApiError
type _ErrorPayload = Parameters<ServerToClientEvents['error']>[0];
type _AssertErrorShape = _ErrorPayload extends ApiError ? true : never;
declare const _assertErrorShape: _AssertErrorShape;
