import { Router, Router as ExpressRouter } from 'express';
import { bootstrapStory } from '../controllers/storyController.js';

const router: ExpressRouter = Router();

router.post('/bootstrap', bootstrapStory);

export default router; 