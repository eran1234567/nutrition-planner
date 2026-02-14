const SUPABASE_URL = 'https://vollogobxbnxyymzhhjq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvbGxvZ29ieGJueHl5bXpoaGpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNDI4NTgsImV4cCI6MjA4MzgxODg1OH0.37hO8pCLsW38fpjzuGGByVKqgga9yVcLvLyccWsDpzo';

async function runBatch(offset) {
  console.log(`\n--- Batch at offset ${offset} ---`);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/backfill-recipe-images`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ globalOnly: true, offset }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Error (${res.status}): ${text}`);
    return null;
  }

  const data = await res.json();
  console.log(`Result: ${data.successCount} success, ${data.failedCount} failed, ${data.total} total`);
  console.log(`Message: ${data.message}`);
  return data;
}

async function main() {
  console.log('Starting global recipe image backfill...');
  let offset = 0;
  let totalSuccess = 0;
  let totalFailed = 0;

  while (true) {
    const result = await runBatch(offset);
    if (!result) {
      console.log('Batch failed, stopping.');
      break;
    }

    totalSuccess += result.successCount || 0;
    totalFailed += result.failedCount || 0;

    if (result.nextOffset === null || result.nextOffset === undefined) {
      console.log('\nNo more batches to process.');
      break;
    }

    offset = result.nextOffset;
    console.log(`Waiting 5s before next batch...`);
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log(`\n=== DONE ===`);
  console.log(`Total success: ${totalSuccess}`);
  console.log(`Total failed: ${totalFailed}`);
}

main().catch(console.error);
