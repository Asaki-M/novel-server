import type { Router as ExpressRouter } from 'express'
import { Router } from 'express'
import { clearSessionHistory, getSessionHistory } from '../controllers/memoryController.js'

const router: ExpressRouter = Router()

router.get('/:sessionId', getSessionHistory)
router.delete('/:sessionId', clearSessionHistory)

export default router
