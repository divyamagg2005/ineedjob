'use server'

import nodemailer from 'nodemailer';
import { getAuthenticatedUserContext } from '@/lib/user-context';

export async function sendEmail({
  providerToken,
  to,
  subject,
  body,
  senderEmail
}: {
  providerToken: string;
  to: string;
  subject: string;
  body: string;
  senderEmail: string;
}) {
  if (!providerToken) {
    return { success: false, error: 'No provider token available. Please log in again.' };
  }

  try {
    const authenticatedUser = await getAuthenticatedUserContext(undefined, undefined, providerToken);

    // We use the Google Access Token (providerToken) to authenticate with Gmail via OAuth2
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: authenticatedUser.email,
        accessToken: providerToken,
      },
    });

    const info = await transporter.sendMail({
      from: senderEmail,
      to,
      subject,
      text: body,
    });

    return { success: true, messageId: info.messageId };
  } catch (error: unknown) {
    console.error('Failed to send email:', error);
    const err = error as Error;
    return { success: false, error: err?.message || 'Failed to send email' };
  }
}
