import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// =====================================================
// AUTO-RETRY REPORT POLLER
// This function polls for pending reports and processes them
// Run it once and it will automatically retry until all reports are done
// =====================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
      }
    });
  }

  try {
    const body = await req.json();
    const { execution_id, max_retries = 10, retry_interval_seconds = 120 } = body;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const processorUrl = `${supabaseUrl}/functions/v1/report-processor`;

    console.log(`Starting report poller for execution_id: ${execution_id || 'ALL'}`);
    console.log(`Max retries: ${max_retries}, Interval: ${retry_interval_seconds}s`);

    const pollResults = {
      total_attempts: 0,
      reports_completed: 0,
      reports_failed: 0,
      final_pending: 0,
      polling_log: []
    };

    for (let attempt = 1; attempt <= max_retries; attempt++) {
      console.log(`\n=== Polling attempt ${attempt}/${max_retries} ===`);
      pollResults.total_attempts = attempt;

      // Call the report-processor
      const processorResponse = await fetch(processorUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ execution_id })
      });

      if (!processorResponse.ok) {
        const errorText = await processorResponse.text();
        console.error(`Processor call failed: ${errorText}`);
        pollResults.polling_log.push({
          attempt,
          status: 'ERROR',
          message: errorText
        });
        continue;
      }

      const result = await processorResponse.json();
      console.log(`Checked: ${result.summary.checked}, Downloaded: ${result.summary.downloaded}, Pending: ${result.summary.still_pending}`);

      pollResults.reports_completed += result.summary.processed;
      pollResults.reports_failed += result.summary.failed;
      pollResults.final_pending = result.summary.still_pending;

      pollResults.polling_log.push({
        attempt,
        checked: result.summary.checked,
        downloaded: result.summary.downloaded,
        processed: result.summary.processed,
        still_pending: result.summary.still_pending,
        failed: result.summary.failed
      });

      // Check if we're done
      if (result.summary.still_pending === 0 && result.summary.checked > 0) {
        console.log('\n✅ All reports processed! Polling complete.');
        pollResults.polling_log.push({
          status: 'COMPLETED',
          message: 'All reports processed successfully'
        });
        break;
      }

      // If no reports were found at all
      if (result.summary.checked === 0) {
        console.log('\n⚠️ No pending reports found. Stopping.');
        pollResults.polling_log.push({
          status: 'NO_REPORTS',
          message: 'No pending reports found in database'
        });
        break;
      }

      // Wait before next attempt (unless it's the last one)
      if (attempt < max_retries && result.summary.still_pending > 0) {
        console.log(`⏳ Waiting ${retry_interval_seconds} seconds before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, retry_interval_seconds * 1000));
      }
    }

    // Final summary
    const finalStatus = pollResults.final_pending === 0 ? 'SUCCESS' :
                        pollResults.total_attempts >= max_retries ? 'MAX_RETRIES_REACHED' :
                        'STOPPED';

    return new Response(
      JSON.stringify({
        success: true,
        status: finalStatus,
        summary: {
          total_attempts: pollResults.total_attempts,
          reports_completed: pollResults.reports_completed,
          reports_failed: pollResults.reports_failed,
          reports_still_pending: pollResults.final_pending,
          max_retries_configured: max_retries,
          retry_interval_seconds: retry_interval_seconds
        },
        polling_log: pollResults.polling_log,
        message: finalStatus === 'SUCCESS' ?
          'All reports processed successfully!' :
          finalStatus === 'MAX_RETRIES_REACHED' ?
          `Reached maximum retries (${max_retries}). ${pollResults.final_pending} reports still pending.` :
          'Polling stopped.'
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );

  } catch (err) {
    console.error("Report poller failed:", err);

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          message: err instanceof Error ? err.message : String(err)
        }
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
});
