import { RedisStore } from "connect-redis";
import redisClient from "./redisClient.js";

const redisStore = new RedisStore({
  client: redisClient,
  prefix: "sess:",
  ttl: 60 * 60 * 24 * 7, // 7 days
});

export default redisStore;
