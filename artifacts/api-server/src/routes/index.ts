import { Router, type IRouter } from "express";
import healthRouter from "./health";
import crawlRouter from "./crawl";

const router: IRouter = Router();

router.use(healthRouter);
router.use(crawlRouter);

export default router;
