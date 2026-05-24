import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import * as userService from './userService';
import { authenticateJwt } from './middleware';

const router = Router();

function validate(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ code: 'VALIDATION_ERROR', details: errors.array() });
    return;
  }
  next();
}

// POST /users
router.post(
  '/',
  [
    body('name').notEmpty().trim(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
  ],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await userService.createUser(req.body);
      res.status(201).json(user);
    } catch (err) {
      res.status(500).json({ code: 'INTERNAL_ERROR', message: String(err) });
    }
  }
);

// POST /users/login
router.post(
  '/login',
  [body('email').isEmail(), body('password').notEmpty()],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const token = await userService.login(req.body);
      if (!token) {
        res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
        return;
      }
      res.json(token);
    } catch (err) {
      res.status(500).json({ code: 'INTERNAL_ERROR', message: String(err) });
    }
  }
);

// GET /users/:id
router.get(
  '/:id',
  authenticateJwt,
  [param('id').isUUID()],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await userService.getUserById(req.params.id);
      if (!user) { res.status(404).json({ code: 'NOT_FOUND' }); return; }
      res.json(user);
    } catch (err) {
      res.status(500).json({ code: 'INTERNAL_ERROR', message: String(err) });
    }
  }
);

// PUT /users/:id
router.put(
  '/:id',
  authenticateJwt,
  [param('id').isUUID()],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await userService.updateUser(req.params.id, req.body);
      if (!user) { res.status(404).json({ code: 'NOT_FOUND' }); return; }
      res.json(user);
    } catch (err) {
      res.status(500).json({ code: 'INTERNAL_ERROR', message: String(err) });
    }
  }
);

// DELETE /users/:id
router.delete(
  '/:id',
  authenticateJwt,
  [param('id').isUUID()],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const deleted = await userService.deleteUser(req.params.id);
      if (!deleted) { res.status(404).json({ code: 'NOT_FOUND' }); return; }
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ code: 'INTERNAL_ERROR', message: String(err) });
    }
  }
);

export default router;
