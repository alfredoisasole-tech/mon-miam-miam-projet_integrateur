import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { authGuards } from '../../src/http/guards.ts';
import { AppError } from '../../src/http/errors.ts';
import type { Request, Response } from 'express';

function mockReqRes(user?: Record<string, unknown>) {
  const req = {} as Request;
  const res = { locals: { authenticatedUser: user } } as unknown as Response;
  let nextCalledWith: unknown = undefined;
  const next = (err?: unknown) => {
    nextCalledWith = err ?? 'OK';
  };
  return { req, res, next, getResult: () => nextCalledWith };
}

describe('Gardes d’accès HTTP (authGuards - Jira 7.1 / D-7)', () => {
  it('authGuards.required : refuse (401) si non authentifié', () => {
    const { req, res, next, getResult } = mockReqRes(undefined);
    authGuards.required(req, res, next);
    const result = getResult();
    assert.ok(result instanceof AppError);
    assert.equal(result.status, 401);
    assert.equal(result.code, 'UNAUTHORIZED');
  });

  it('authGuards.required : refuse (403) si le compte est désactivé', () => {
    const { req, res, next, getResult } = mockReqRes({ id: 'usr_1', status: 'inactive' });
    authGuards.required(req, res, next);
    const result = getResult();
    assert.ok(result instanceof AppError);
    assert.equal(result.status, 403);
    assert.equal(result.code, 'ACCOUNT_DISABLED');
  });

  it('authGuards.required : autorise l’utilisateur actif', () => {
    const { req, res, next, getResult } = mockReqRes({ id: 'usr_1', status: 'active', role: 'student' });
    authGuards.required(req, res, next);
    assert.equal(getResult(), 'OK');
  });

  it('authGuards.role : refuse un utilisateur avec un mauvais rôle (403)', () => {
    const guard = authGuards.role('admin', 'manager');
    const { req, res, next, getResult } = mockReqRes({ id: 'usr_1', status: 'active', role: 'student' });
    guard(req, res, next);
    const result = getResult();
    assert.ok(result instanceof AppError);
    assert.equal(result.status, 403);
    assert.equal(result.code, 'FORBIDDEN');
  });

  it('authGuards.role : autorise si le rôle correspond', () => {
    const guard = authGuards.role('admin', 'manager');
    const { req, res, next, getResult } = mockReqRes({ id: 'usr_admin', status: 'active', role: 'admin' });
    guard(req, res, next);
    assert.equal(getResult(), 'OK');
  });

  it('authGuards.staffOnly : vérifie le rôle staff et la présence d’un restaurant rattaché', () => {
    const { req: r1, res: res1, next: n1, getResult: g1 } = mockReqRes({ id: 'u1', role: 'employee' }); // pas de restaurantId
    authGuards.staffOnly(r1, res1, n1);
    assert.equal((g1() as AppError).status, 403);

    const { req: r2, res: res2, next: n2, getResult: g2 } = mockReqRes({ id: 'u2', role: 'employee', restaurantId: 'rst_1' });
    authGuards.staffOnly(r2, res2, n2);
    assert.equal(g2(), 'OK');
  });
});
