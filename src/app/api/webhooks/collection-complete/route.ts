import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tenant_id, week_id, status } = body;

    if (!tenant_id) {
      return NextResponse.json({ error: "Missing tenant_id" }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Get User Email (tenant_id IS the user_id in your schema)
    // We need to use the admin client or similar to get user email by ID, 
    // BUT since Supabase Auth isn't directly queryable via public API without admin rights,
    // we'll assume the credentials table might have it OR we use the admin client.
    // For now, let's try to get it from the 'credentials' table if you store it there, 
    // OR we just use the ID if we can't get the email. 
    // WAIT - Standard Supabase pattern: auth.users is private.
    // However, usually there's a public 'users' or 'profiles' table.
    // Let's check if we can get the email. If not, we might need the email passed from n8n.
    // Ideally n8n passes the email it got from Flow 1.
    
    // Let's assume n8n passes 'email' if possible. If not, we'll try to fetch it.
    let userEmail = body.email;

    if (!userEmail) {
       // Attempt to fetch from a public profile table if it exists, or fail gracefully.
       // Since I don't see a 'users' table in your schema dump earlier, 
       // I'll rely on n8n passing the email.
       return NextResponse.json({ error: "Email not provided in payload" }, { status: 400 });
    }

    // 2. Send Email
    const { success, error } = await sendEmail({
      to: userEmail,
      subject: `BidFlow Data Ready: Week ${week_id}`,
      html: `
        <h1>Your Amazon Placement Data is Ready</h1>
        <p>Good news! Amazon has finished generating your reports for <strong>${week_id}</strong>.</p>
        <p>Your dashboard has been updated with the latest placement performance data.</p>
        <br />
        <a href="https://bidflow.app/dashboard" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Dashboard</a>
        <br /><br />
        <p>Happy optimizing,<br/>The BidFlow Team</p>
      `
    });

    if (!success) {
      console.error("Failed to send email:", error);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Email sent" });

  } catch (error) {
    console.error("Error in collection-complete webhook:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
