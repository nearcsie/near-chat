import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../../src/middlewares/authMiddleware';
import * as jwtHelper from '../../../src/auth/jwt';
import { AppError } from '../../../src/errors/AppError';
import pool from '../../../src/db';

vi.mock('../../../src/db', () => ({
  default: { query: vi.fn() },
}));

describe('authMiddleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {};
    nextFunction = vi.fn();
    // vi.restoreAllMocks() resets vi.fn() implementations, so re-apply after each test
    vi.mocked(pool.query).mockResolvedValue({ rows: [{}] } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls next with 401 when auth token is missing', async () => {
    await authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
    expect(nextFunction).toHaveBeenCalledOnce();
    const arg = vi.mocked(nextFunction).mock.calls[0][0] as AppError;
    expect(arg).toBeInstanceOf(AppError);
    expect(arg.statusCode).toBe(401);
    expect(arg.message).toMatch(/Missing authentication token/);
  });

  it('calls next with 401 when Authorization header is malformed and no cookie exists', async () => {
    mockRequest.headers = { authorization: 'Basic sometoken' };
    await authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
    expect(nextFunction).toHaveBeenCalledOnce();
    const arg = vi.mocked(nextFunction).mock.calls[0][0] as AppError;
    expect(arg).toBeInstanceOf(AppError);
    expect(arg.statusCode).toBe(401);
    expect(arg.message).toMatch(/Missing authentication token/);
  });

  it('calls next with 401 when token is invalid', async () => {
    mockRequest.headers = { authorization: 'Bearer invalid-token' };
    vi.spyOn(jwtHelper, 'verifyToken').mockImplementation(() => {
      throw new Error('Invalid token');
    });

    await authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
    expect(nextFunction).toHaveBeenCalledOnce();
    const arg = vi.mocked(nextFunction).mock.calls[0][0] as AppError;
    expect(arg).toBeInstanceOf(AppError);
    expect(arg.statusCode).toBe(401);
    expect(arg.message).toMatch(/Invalid token/);
  });

  it('calls next() and populates req.user when token is valid and user is active', async () => {
    mockRequest.headers = { authorization: 'Bearer valid-token' };
    const mockPayload = { userId: '1', name: 'Test User' };
    
    vi.spyOn(jwtHelper, 'verifyToken').mockReturnValue(mockPayload);

    await authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockRequest.user).toEqual(mockPayload);
    expect(nextFunction).toHaveBeenCalledOnce();
    expect(nextFunction).toHaveBeenCalledWith(); // called with no args
  });

  it('prefers the HttpOnly auth cookie token when present', async () => {
    mockRequest.headers = {
      authorization: 'Bearer header-token',
      cookie: 'theme=dark; auth_token=cookie-token',
    };
    const mockPayload = { userId: '1', name: 'Test User' };

    vi.spyOn(jwtHelper, 'verifyToken').mockReturnValue(mockPayload);

    await authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(jwtHelper.verifyToken).toHaveBeenCalledWith('cookie-token');
    expect(mockRequest.user).toEqual(mockPayload);
    expect(nextFunction).toHaveBeenCalledOnce();
    expect(nextFunction).toHaveBeenCalledWith();
  });

  it('calls next with 401 when user is not found in the database', async () => {
    mockRequest.headers = { authorization: 'Bearer valid-token' };
    vi.spyOn(jwtHelper, 'verifyToken').mockReturnValue({ userId: '1', name: 'Test User' });
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as any);
    await authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
    const arg = vi.mocked(nextFunction).mock.calls[0][0] as AppError;
    expect(arg).toBeInstanceOf(AppError);
    expect(arg.statusCode).toBe(401);
    expect(arg.message).toMatch(/not found or deleted/);
  });

  it('calls next with the original AppError when verifyToken throws an AppError', async () => {
    mockRequest.headers = { authorization: 'Bearer valid-token' };
    const customErr = new AppError(403, 'Custom forbidden');
    vi.spyOn(jwtHelper, 'verifyToken').mockImplementation(() => { throw customErr; });
    await authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
    expect(nextFunction).toHaveBeenCalledWith(customErr);
  });
});
