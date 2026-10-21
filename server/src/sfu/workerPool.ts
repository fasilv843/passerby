import { createWorker, type types } from "mediasoup";
import { createLogger } from "../logger";

const log = createLogger("sfu");

/**
 * mediasoup workers are separate C++ processes that move the media.
 * Each uses one CPU core, so rooms are spread across them round-robin.
 */
export class WorkerPool {
  private nextIndex = 0;

  private constructor(private readonly workers: types.Worker[]) {}

  static async create(count: number): Promise<WorkerPool> {
    const workers = await Promise.all(
      Array.from({ length: count }, async () => {
        const worker = await createWorker({ logLevel: "warn" });
        worker.on("died", (err) => {
          // Every room on this worker is gone; mediasoup recommends restarting the process.
          log.error(`worker ${worker.pid} died, exiting`, err);
          setTimeout(() => process.exit(1), 2000);
        });
        return worker;
      })
    );
    log.info(`started ${workers.length} mediasoup worker(s)`);
    return new WorkerPool(workers);
  }

  next(): types.Worker {
    const worker = this.workers[this.nextIndex];
    this.nextIndex = (this.nextIndex + 1) % this.workers.length;
    return worker;
  }

  close() {
    this.workers.forEach((worker) => worker.close());
  }
}
