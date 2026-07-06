import { Resend } from "resend";
import { RESEND_CONFIG } from "../config/config.js";

const resend = new Resend(RESEND_CONFIG.key);

const EMAIL_FROM = RESEND_CONFIG.emailFrom;
const EMAIL_SENDER_NAME = RESEND_CONFIG.emailSenderName || "ReelCore";

export { resend, EMAIL_FROM, EMAIL_SENDER_NAME };
