import MosaicConfig from "../models/MosaicConfig.js";
import { runMosaicPipelineFromConfig } from "../controllers/mosaicController.js";

const CHECK_INTERVAL_MS = 60 * 1000;

export const startMosaicScheduler = () => {
  let running = false;

  const tick = async () => {
    if (running) return;
    try {
      const config = await MosaicConfig.findOne();
      if (!config || !config.enabled) return;
      if (!config.mainImageUrl) return;

      const intervalMs =
        (Number(config.intervalHours) || 24) * 60 * 60 * 1000;
      const lastRun = config.lastRunAt ? config.lastRunAt.getTime() : 0;
      if (Date.now() - lastRun < intervalMs) return;

      running = true;
      await runMosaicPipelineFromConfig(config);
    } catch (error) {
      console.error("Error en scheduler de mosaico:", error);
    } finally {
      running = false;
    }
  };

  tick();
  setInterval(tick, CHECK_INTERVAL_MS);
};
