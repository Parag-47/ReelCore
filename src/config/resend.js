import { Resend } from "resend";
import config from "./config.js";

const { resendConfig } = config;

const resend = new Resend(resendConfig.key);

const EMAIL_FROM = resendConfig.emailFrom || "onboarding@resend.dev";
const EMAIL_SENDER_NAME = resendConfig.emailSenderName || "ReelCore";

export { resend, EMAIL_FROM, EMAIL_SENDER_NAME };
