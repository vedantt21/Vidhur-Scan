const DEFAULT_SMTP_PORT = 587;
const DEFAULT_MAIL_FROM = "Ingredient Screen <no-reply@example.com>";

function parseBoolean(value, fallback = false) {
  if (value == null || value === "") {
    return fallback;
  }

  return String(value).toLowerCase() === "true";
}

function readMailConfig() {
  return {
    smtpHost: String(process.env.SMTP_HOST || "").trim(),
    smtpPort: Number(process.env.SMTP_PORT || DEFAULT_SMTP_PORT),
    smtpSecure: parseBoolean(process.env.SMTP_SECURE, false),
    smtpUser: String(process.env.SMTP_USER || "").trim(),
    smtpPass: String(process.env.SMTP_PASS || "").trim(),
    mailFrom: String(process.env.MAIL_FROM || process.env.SMTP_USER || DEFAULT_MAIL_FROM).trim()
  };
}

function buildVerificationEmail({ name, verificationUrl }) {
  const greeting = name ? `Hi ${name},` : "Hello,";
  const subject = "Verify your Ingredient Screen account";
  const text = [
    greeting,
    "",
    "Please verify your email address to finish setting up your Ingredient Screen account.",
    "",
    `Verify now: ${verificationUrl}`,
    "",
    "If you did not create this account, you can ignore this email."
  ].join("\n");
  const html = `
    <div style="font-family: Avenir Next, Trebuchet MS, sans-serif; color: #1f2933; line-height: 1.6;">
      <p>${greeting}</p>
      <p>Please verify your email address to finish setting up your Ingredient Screen account.</p>
      <p>
        <a
          href="${verificationUrl}"
          style="display:inline-block;padding:12px 18px;border-radius:999px;background:#b4572f;color:#ffffff;text-decoration:none;font-weight:700;"
        >
          Verify email
        </a>
      </p>
      <p style="font-size:14px;color:#61727a;">If the button does not work, use this link:</p>
      <p><a href="${verificationUrl}">${verificationUrl}</a></p>
      <p style="font-size:14px;color:#61727a;">If you did not create this account, you can ignore this email.</p>
    </div>
  `;

  return {
    subject,
    text,
    html
  };
}

async function sendVerificationEmail({ email, name, verificationUrl }) {
  const config = readMailConfig();
  const message = buildVerificationEmail({ name, verificationUrl });

  if (!config.smtpHost) {
    process.stdout.write(`Verification email preview for ${email}: ${verificationUrl}\n`);

    return {
      delivery: "preview",
      previewUrl: verificationUrl
    };
  }

  let nodemailer;

  try {
    nodemailer = require("nodemailer");
  } catch (error) {
    throw new Error("SMTP is configured, but nodemailer is not installed. Run npm install.");
  }

  const transport = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: config.smtpUser
      ? {
          user: config.smtpUser,
          pass: config.smtpPass
        }
      : undefined
  });

  await transport.sendMail({
    from: config.mailFrom,
    to: email,
    subject: message.subject,
    text: message.text,
    html: message.html
  });

  return {
    delivery: "smtp",
    previewUrl: null
  };
}

module.exports = {
  sendVerificationEmail
};
