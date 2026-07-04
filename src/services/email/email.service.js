import { resend, EMAIL_FROM, EMAIL_SENDER_NAME } from "../../config/resend.js";
import config from "../../config/config.js";
import ApiError from "../../shared/utils/ApiError.js";

// TODO: create a template and use the template here
const sendVerificationEmail = async (to, username, token) => {
  const verificationUrl = `${config.frontendURL}/verify?token=${token}`;

  const { data, error } = await resend.emails.send({
    from: `${EMAIL_SENDER_NAME} <${EMAIL_FROM}>`,
    to: [to],
    subject: "Verify your ReelCore account",
    html: `
      <!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Verify your ReelCore account</title>
  </head>

  <body
    style="
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
      font-family: Arial, Helvetica, sans-serif;
      color: #333333;
    "
  >
    <table
      role="presentation"
      width="100%"
      cellspacing="0"
      cellpadding="0"
      style="padding: 40px 20px;"
    >
      <tr>
        <td align="center">
          <table
            role="presentation"
            width="600"
            cellspacing="0"
            cellpadding="0"
            style="
              background: #ffffff;
              border-radius: 10px;
              overflow: hidden;
              border: 1px solid #e5e5e5;
            "
          >
            <!-- Header -->
            <tr>
              <td
                align="center"
                style="
                  background: #111111;
                  color: white;
                  padding: 32px;
                  font-size: 28px;
                  font-weight: bold;
                "
              >
                ReelCore
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding: 40px;">
                <h2
                  style="
                    margin-top: 0;
                    color: #111111;
                    font-size: 24px;
                  "
                >
                  Verify your email address
                </h2>

                <p style="font-size: 16px; line-height: 1.7;">
                  Hi <strong>${username}</strong>,
                </p>

                <p style="font-size: 16px; line-height: 1.7;">
                  Thanks for signing up for <strong>ReelCore</strong>.
                  Please verify your email address to activate your account.
                </p>

                <table
                  role="presentation"
                  cellspacing="0"
                  cellpadding="0"
                  style="margin: 35px 0;"
                >
                  <tr>
                    <td
                      style="
                        border-radius: 6px;
                        background: #111111;
                      "
                    >
                      <a
                        href="${verificationUrl}"
                        style="
                          display: inline-block;
                          padding: 14px 28px;
                          color: white;
                          text-decoration: none;
                          font-weight: bold;
                          font-size: 16px;
                        "
                      >
                        Verify Email
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="font-size: 16px; line-height: 1.7;">
                  If the button doesn't work, copy and paste the following link
                  into your browser:
                </p>

                <p
                  style="
                    word-break: break-word;
                    background: #f5f5f5;
                    padding: 12px;
                    border-radius: 6px;
                    font-size: 14px;
                  "
                >
                  ${verificationUrl}
                </p>

                <p style="font-size: 16px; line-height: 1.7;">
                  This verification link will expire in
                  <strong>15 minutes</strong>.
                </p>

                <p style="font-size: 16px; line-height: 1.7;">
                  If you didn't create a ReelCore account, you can safely ignore
                  this email.
                </p>

                <p
                  style="
                    margin-top: 40px;
                    font-size: 16px;
                    line-height: 1.7;
                  "
                >
                  Regards,<br />
                  <strong>The ReelCore Team</strong>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td
                align="center"
                style="
                  padding: 24px;
                  background: #fafafa;
                  color: #777777;
                  font-size: 13px;
                  border-top: 1px solid #eeeeee;
                "
              >
                © ${new Date().getFullYear()} ReelCore. All rights reserved.
                <br /><br />
                This is an automated email. Please do not reply.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
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
