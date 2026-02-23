import { Resend } from 'resend';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailOptions) {
  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    console.error('RESEND_API_KEY is missing');
    return { success: false, error: 'Configuration error: Missing Email API Key' };
  }

  const resend = new Resend(apiKey);

  try {
    const data = await resend.emails.send({
      from: 'BidFlow <notifications@bidflow.app>',
      to,
      subject,
      html,
    });

    return { success: true, data };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error };
  }
}
