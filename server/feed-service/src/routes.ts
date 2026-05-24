import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import * as feedService from './feedService';
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

router.post(
  '/',
  authenticateJwt,
  [body('content').notEmpty().trim().isLength({ max: 2000 })],
  validate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const feed = await feedService.createFeed(req.user!.sub, req.body);
      res.status(201).json(feed);
    } catch (err) {
      res.status(500).json({ code: 'INTERNAL_ERROR', message: String(err) });
    }
  }
);

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const feeds = await feedService.getFeeds({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    });
    res.json(feeds);
  } catch (err) {
    res.status(500).json({ code: 'INTERNAL_ERROR', message: String(err) });
  }
});

router.get('/:id', [param('id').isUUID()], validate, async (req: Request, res: Response): Promise<void> => {
  try {
    const feed = await feedService.getFeedById(req.params.id);
    if (!feed) { res.status(404).json({ code: 'NOT_FOUND' }); return; }
    res.json(feed);
  } catch (err) {
    res.status(500).json({ code: 'INTERNAL_ERROR', message: String(err) });
  }
});

router.delete('/:id', authenticateJwt, [param('id').isUUID()], validate, async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await feedService.deleteFeed(req.params.id, req.user!.sub);
    if (!deleted) { res.status(404).json({ code: 'NOT_FOUND' }); return; }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ code: 'INTERNAL_ERROR', message: String(err) });
  }
});

export default router;
