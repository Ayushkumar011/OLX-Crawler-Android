import { Router, type IRouter } from "express";
import healthRouter from "./health";
import crawlRouter from "./crawl";
import watchlistRouter from "./watchlist";
import negativeKeywordsRouter from "./negativeKeywords";

const router: IRouter = Router();

router.use(healthRouter);
router.use(crawlRouter);
router.use("/watchlist", watchlistRouter);
router.use("/negative-keywords", negativeKeywordsRouter);

export default router;
