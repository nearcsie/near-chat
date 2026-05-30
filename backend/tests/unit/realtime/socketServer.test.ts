import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ForbiddenError, NotFoundError } from '../../../src/errors/AppError';
import { attachSockets } from '../../../src/realtime/socketServer';
import type { ChatServer } from '../../../src/realtime/authSocket';
import type { MessageWithSender } from '../../../../shared/types';

const message: MessageWithSender = {
  messageId: 'msg-1',
  roomId: 'room-1',
  senderId: 'user-1',
  content: 'hello',
  isRecalled: false,
  sentAt: new Date('2026-01-01T00:00:00.000Z'),
  sender: { userId: 'user-1', name: 'Alice' },
};

describe('attachSockets', () => {
  let connectionHandler: any;
  let handlers: Record<string, any>;
  let socket: any;
  let roomEmit: ReturnType<typeof vi.fn>;
  let service: {
    sendMessage: ReturnType<typeof vi.fn>;
    recallMessage: ReturnType<typeof vi.fn>;
  };
  let repo: { findById: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    handlers = {};
    roomEmit = vi.fn();
    socket = {
      data: { user: { userId: 'user-1', name: 'Alice' } },
      join: vi.fn(),
      leave: vi.fn(),
      emit: vi.fn(),
      to: vi.fn(() => ({ emit: vi.fn() })),
      on: vi.fn((event, handler) => {
        handlers[event] = handler;
      }),
    };
    service = {
      sendMessage: vi.fn(),
      recallMessage: vi.fn(),
    };
    repo = { findById: vi.fn() };

    const io = {
      on: vi.fn((event, handler) => {
        if (event === 'connection') connectionHandler = handler;
      }),
      to: vi.fn(() => ({ emit: roomEmit })),
    } as unknown as ChatServer;

    attachSockets(io, { messageService: service, messageRepository: repo });
    connectionHandler(socket);
  });

  it('handles join_room and leave_room', () => {
    handlers.join_room({ roomId: 'room-1' });
    handlers.leave_room({ roomId: 'room-1' });

    expect(socket.join).toHaveBeenCalledWith('room_room-1');
    expect(socket.leave).toHaveBeenCalledWith('room_room-1');
  });

  it('sends messages through messageService and emits new_message to the room', async () => {
    service.sendMessage.mockResolvedValue(message);

    await handlers.send_message({ roomId: 'room-1', content: 'hello', replyTo: 'msg-0' });

    expect(service.sendMessage).toHaveBeenCalledWith('user-1', 'room-1', 'hello', {
      replyToId: 'msg-0',
    });
    expect(roomEmit).toHaveBeenCalledWith('new_message', message);
  });

  it('emits ApiError payloads when send_message fails', async () => {
    service.sendMessage.mockRejectedValue(new NotFoundError('room', 'missing'));

    await handlers.send_message({ roomId: 'missing', content: 'hello' });

    expect(socket.emit).toHaveBeenCalledWith('error', {
      statusCode: 404,
      message: 'room with id missing not found',
      code: 'NOT_FOUND',
    });
  });

  it('recalls messages only for the original sender', async () => {
    repo.findById.mockResolvedValue(message);
    service.recallMessage.mockResolvedValue({ ...message, isRecalled: true });

    await handlers.recall_message({ messageId: 'msg-1' });

    expect(service.recallMessage).toHaveBeenCalledWith('user-1', 'room-1', 'msg-1');
    expect(roomEmit).toHaveBeenCalledWith('message_recalled', { messageId: 'msg-1' });
  });

  it('emits ForbiddenError when recall_message caller is not the sender', async () => {
    repo.findById.mockResolvedValue({ ...message, senderId: 'user-2' });

    await handlers.recall_message({ messageId: 'msg-1' });

    expect(service.recallMessage).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('error', {
      statusCode: 403,
      message: 'Only the original sender can recall this message',
      code: 'FORBIDDEN',
    });
  });

  it('broadcasts typing and read receipts', () => {
    const socketRoomEmit = vi.fn();
    socket.to.mockReturnValue({ emit: socketRoomEmit });

    handlers.typing({ roomId: 'room-1', isTyping: true });
    handlers.read_receipt({ roomId: 'room-1', messageId: 'msg-1' });

    expect(socketRoomEmit).toHaveBeenCalledWith('user_typing', {
      roomId: 'room-1',
      userId: 'user-1',
      isTyping: true,
    });
    expect(socketRoomEmit).toHaveBeenCalledWith('read_update', {
      roomId: 'room-1',
      userId: 'user-1',
      messageId: 'msg-1',
    });
  });
});
