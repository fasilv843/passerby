import winston from "winston";

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
    new winston.transports.File({ filename: "logs/app.log" }),
  ],
});
