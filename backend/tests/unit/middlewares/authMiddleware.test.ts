import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../../src/middlewares/authMiddleware';
import * as jwtHelper from '../../../src/auth/jwt';
import { AppError } from '../../../src/errors/AppError';

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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws 401 when Authorization header is missing', () => {
    try {
      authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
      expect.fail('Should have thrown AppError');
    } catch (e: any) {
      expect(e).toBeInstanceOf(AppError);
      expect(e.statusCode).toBe(401);
      expect(e.message).toMatch(/Missing or invalid/);
    }
  });

  it('throws 401 when Authorization header is malformed', () => {
    mockRequest.headers = { authorization: 'Basic sometoken' };
    try {
      authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
      expect.fail('Should have thrown AppError');
    } catch (e: any) {
      expect(e).toBeInstanceOf(AppError);
      expect(e.statusCode).toBe(401);
      expect(e.message).toMatch(/Missing or invalid/);
    }
  });

  it('throws 401 when token is invalid', () => {
    mockRequest.headers = { authorization: 'Bearer invalid-token' };
    vi.spyOn(jwtHelper, 'verifyToken').mockImplementation(() => {
      throw new Error('Invalid token');
    });

    try {
      authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
      expect.fail('Should have thrown AppError');
    } catch (e: any) {
      expect(e).toBeInstanceOf(AppError);
      expect(e.statusCode).toBe(401);
      expect(e.message).toMatch(/Invalid token/);
    }
  });

  it('calls next() and populates req.user when token is valid', () => {
    mockRequest.headers = { authorization: 'Bearer valid-token' };
    const mockPayload = { userId: '1', name: 'Test User' };
    
    vi.spyOn(jwtHelper, 'verifyToken').mockReturnValue(mockPayload);

    authMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockRequest.user).toEqual(mockPayload);
    expect(nextFunction).toHaveBeenCalledOnce();
  });
});
