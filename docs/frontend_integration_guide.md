# Frontend Integration Guide

This guide summarizes the API contracts the frontend should use. The source of truth is `docs/api-documentation.md`; when this guide and the API documentation differ, use `docs/api-documentation.md`.

## Environment

Docker Compose exposes the services on these host ports:

- Frontend: `http://localhost:3005`
- Backend: `http://localhost:4005`
- PostgreSQL: `localhost:5435`

For browser requests from the frontend, set:

```env
NEXT_PUBLIC_API_URL=http://localhost:4005
```

All REST paths below are under:

```text
/api/v1
```

Authenticated requests must include:

```http
Authorization: Bearer <JWT>
```

## User Profile And Settings

Use separate profile and settings flows.

| Purpose | Method | Path |
| --- | --- | --- |
| Read my profile | `GET` | `/users/me` |
| Update my profile | `PATCH` | `/users/me` |
| Read public profile | `GET` | `/users/:id` |
| Read my settings | `GET` | `/users/me/settings` |
| Update my settings | `PATCH` | `/users/me/settings` |

Profile fields:

```ts
{
  name?: string;
  email?: string;
  password?: string;
  bio?: string;
  avatarUrl?: string;
}
```

Settings fields:

```ts
{
  warningEnabled?: boolean;
  warningDays?: number;
  language?: string;
  theme?: "light" | "dark";
  notifyDesktop?: boolean;
  notifySound?: boolean;
}
```

Profile settings shown in the UI should be persisted through these backend APIs. Do not treat theme, desktop notifications, or sound notifications as local-only state.

## Friends, Requests, Blocks, And Search

Use the latest friend request routes. Deprecated friend request paths should not be used.

| Purpose | Method | Path |
| --- | --- | --- |
| List friends | `GET` | `/friends` |
| Remove friend | `DELETE` | `/friends/:id` |
| List pending requests | `GET` | `/friend-requests` |
| Send request | `POST` | `/friend-requests` |
| Accept or reject request | `PATCH` | `/friend-requests/:id` |
| Block user | `POST` | `/blocks` |
| Unblock user | `DELETE` | `/blocks/:id` |
| Search users | `GET` | `/users?q=<query>` |

Friend request payloads use camelCase:

```ts
{ targetUserId: string }
{ status: "accepted" | "rejected" }
```

Private rooms are created lazily. After a friendship exists, the UI can show a "send message" action. When the user opens that action, call `POST /rooms` with `type: "private"` and `targetUserId`. If a private room already exists for the pair, backend returns the existing room instead of creating a duplicate.

## Rooms

| Purpose | Method | Path |
| --- | --- | --- |
| List my rooms | `GET` | `/rooms` |
| Create group | `POST` | `/rooms` |
| Open or create private room | `POST` | `/rooms` |
| Read room | `GET` | `/rooms/:id` |
| Update room | `PATCH` | `/rooms/:id` |
| Archive group | `DELETE` | `/rooms/:id` |
| Join by invite code | `POST` | `/rooms/:id/members` |
| Leave room | `DELETE` | `/rooms/:id/members/me` |

Create group:

```ts
{
  type: "group";
  name: string;
  avatarUrl?: string;
  requireApproval?: boolean;
  viewHistory?: boolean;
}
```

Open or create private room:

```ts
{
  type: "private";
  targetUserId: string;
}
```

Archive semantics:

- `DELETE /rooms/:id` permanently deletes an owner-managed group.
- Deletion removes the room for every member; private-room read-only behavior still uses `isArchived`/`isReadonly` semantics elsewhere.
- API responses expose `isArchived`; frontend should not depend on legacy read-only or private-room hash fields.

## Group Members

Use the unified member routes. Do not use `/approve` or `/transfer-owner`.

| Purpose | Method | Path |
| --- | --- | --- |
| List members | `GET` | `/rooms/:id/members` |
| Approve or update member | `PATCH` | `/rooms/:id/members/:userId` |
| Remove member | `DELETE` | `/rooms/:id/members/:userId` |
| Transfer owner | `PATCH` | `/rooms/:id` |

Approve pending member:

```ts
{ status: "approved" }
```

Update member:

```ts
{
  role?: "owner" | "admin" | "member";
  nickname?: string;
  isMuted?: boolean;
}
```

Transfer owner:

```ts
{ ownerId: string }
```

## Messages And Attachments

| Purpose | Method | Path |
| --- | --- | --- |
| List messages | `GET` | `/rooms/:roomId/messages` |
| Upload attachment | `POST` | `/attachments` |
| Download attachment | `GET` | `/attachments/:id` |

List messages query:

```text
?before_id=<messageId>&limit=<number>
```

`POST /attachments` returns an `Attachment` object:

```ts
{
  attachmentId: string;
  messageId?: string;
  uploadedBy: string;
  fileUrl: string;
  fileType: string;
  originalName: string;
  uploadedAt: string;
}
```

Socket `send_message` uses `attachmentIds`:

```ts
{
  roomId: string;
  content: string;
  replyTo?: string;
  attachmentIds?: string[];
}
```

`MessageWithSender.attachments` is an array of `Attachment` objects.

## Socket.IO

Connect with the same backend URL:

```ts
const socket = io("http://localhost:4005", {
  auth: { token },
});
```

Client to server:

| Event | Payload |
| --- | --- |
| `join_room` | `{ roomId }` |
| `leave_room` | `{ roomId }` |
| `send_message` | `{ roomId, content, replyTo?, attachmentIds? }` |
| `recall_message` | `{ messageId }` |
| `typing` | `{ roomId, isTyping }` |
| `read_receipt` | `{ roomId, messageId }` |

Server to client:

| Event | Payload |
| --- | --- |
| `new_message` | `MessageWithSender` |
| `message_recalled` | `{ messageId }` |
| `user_typing` | `{ roomId, userId, isTyping }` |
| `read_update` | `{ roomId, userId, messageId }` |
| `room_update` | `{ type, data }` |
| `friend_request` | `FriendRequest` |
| `emergency_alert` | `{ userId, message }` |
| `error` | `ApiError` |

## Emergency Contacts

| Purpose | Method | Path |
| --- | --- | --- |
| List contacts | `GET` | `/users/me/emergency-contacts` |
| Add or update contact | `POST` | `/users/me/emergency-contacts` |
| Delete contact | `DELETE` | `/users/me/emergency-contacts/:contactId` |
| Trigger alert | `POST` | `/users/me/emergency-alert` |
| Check inactivity | `POST` | `/users/me/emergency-alert/check-inactivity` |

Emergency settings live in `GET/PATCH /users/me/settings`.
