import winston from "winston";
import LokiTransport from "winston-loki";
import { envConfig } from "../configs/environments";

export const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(), // structured JSON logs
  defaultMeta: { service: "passerby-app" },
  transports: [
    // Console logs for local debugging
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),

    // Loki transport
    new LokiTransport({
      host: envConfig.lokiUrl,
      labels: { job: "passerby-app" }, // custom label for querying
      json: true,
      batching: true,
      interval: 2000,   // flush every 2 seconds
      replaceTimestamp: true
    }),
    new winston.transports.File({ filename: "logs/app.log" }),
  ],
});
