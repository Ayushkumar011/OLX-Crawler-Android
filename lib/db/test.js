import pg from "pg";

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    await client.connect();
    const res = await client.query("SELECT COUNT(*) FROM crawl_sessions;");
    const res2 = await client.query("SELECT COUNT(*) FROM listings;");
    console.log(`Crawl sessions count: ${res.rows[0].count}`);
    console.log(`Listings count: ${res2.rows[0].count}`);
    await client.end();
  } catch (err) {
    console.error(err);
  }
}

run();
