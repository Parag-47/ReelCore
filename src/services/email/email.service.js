import { resend, EMAIL_FROM, EMAIL_SENDER_NAME } from "../../config/resend.js";
import config from "../../config/config.js";
import ApiError from "../../shared/utils/ApiError.js";

const sendVerificationEmail = async (to, username, token) => {
  const verificationUrl = `${config.frontendURL}/verify?token=${token}`;

  const { data, error } = await resend.emails.send({
    from: `${EMAIL_SENDER_NAME} <${EMAIL_FROM}>`,
    to: [to],
    subject: "Verify your ReelCore account",
    html: `
      <h1>Welcome to ReelCore, ${username}!</h1>
      <p>Click the link below to verify your account:</p>
      <a href="${verificationUrl}" style="padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 6px;">
        Verify Account
      </a>
      <p>Or copy this link: ${verificationUrl}</p>
      <p>This link expires in 15 minutes.</p>
    `,
  });

  if (error) {
    throw new ApiError(
      500,
      "Failed to send verification email. Please try again.",
      error
    );
  }

  return data;
};

export default sendVerificationEmail;
