import type { Sender } from '@prisma/client';
import nodemailer, { type Transporter } from 'nodemailer';

const transporters = new Map<string, Transporter>();

function getTransporter(sender: Sender): Transporter {
  const existing = transporters.get(sender.id);
  if (existing) return existing;

  const transporter = nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: sender.smtpPort === 465,
    auth: { user: sender.smtpUser, pass: sender.smtpPass },
  });
  transporters.set(sender.id, transporter);
  return transporter;
}

export async function sendEmailViaSender(
  sender: Sender,
  email: {
    recipientEmail: string;
    subject: string;
    bodyHtml: string;
    attachments?: Array<{ attachment: { fileName: string; mimeType: string; data: Uint8Array } }>;
  },
): Promise<{ previewUrl: string | null }> {
  const info = await getTransporter(sender).sendMail({
    from: { name: sender.name, address: sender.email },
    to: email.recipientEmail,
    subject: email.subject,
    html: email.bodyHtml,
    attachments: email.attachments?.map(({ attachment }) => ({
      filename: attachment.fileName,
      content: Buffer.from(attachment.data),
      contentType: attachment.mimeType,
    })),
  });
  const previewUrl = nodemailer.getTestMessageUrl(info);
  return { previewUrl: typeof previewUrl === 'string' ? previewUrl : null };
}
