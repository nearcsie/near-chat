# End-to-End Encryption Scope

## Decision

End-to-end encryption is out of scope for the current v1 course submission.

The application currently stores message content as plaintext in the backend database and serves it through the REST message APIs and Socket.IO events. The frontend does not encrypt outgoing messages or decrypt incoming message history locally.

This matches `docs/report-1.md`, which lists E2E encryption as a second-stage stretch challenge after the first-stage chat system is complete.

## Current v1 Behavior

- Backend message persistence stores `messages.content` as readable text.
- Socket.IO `send_message` accepts plaintext `content`.
- REST message history returns plaintext `content`.
- Attachment upload/download behavior is not encrypted by the client.
- Search, moderation, validation, and tests assume plaintext message content.

## Future Work Required Before Implementing E2E

If the team later decides to bring E2E encryption into scope, define these items before changing the schema or API contract:

- Key management: device keys, room keys, rotation, backup, and lost-device recovery.
- Encrypted payload shape: ciphertext, nonce/IV, algorithm version, sender key id, and optional authenticated metadata.
- Message search: local decrypted search only, or a separate encrypted-search design.
- Attachments: client-side file encryption, encrypted thumbnails/previews, and metadata leakage rules.
- Socket and REST contracts: whether plaintext `content` is replaced or kept only for legacy rooms.
- Migration plan: how existing plaintext messages are handled.
- Testing: unit/e2e coverage that proves the backend stores ciphertext only.

Until those decisions exist, new code should not partially encrypt messages because that would create a misleading security boundary.
