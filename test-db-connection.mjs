import pkg from 'pg';
const { Pool } = pkg;
import { readFileSync } from 'fs';

// Parse .env file manually
const envFile = readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

async function testConnection() {
  console.log('Testing PostgreSQL connection...');
  console.log('Host:', env.DB_HOST);
  console.log('Port:', env.DB_PORT);
  console.log('Database:', env.DB_NAME);
  console.log('User:', env.DB_USER);
  console.log('SSL:', env.DB_SSL);
  console.log('');

  const pool = new Pool({
    host: env.DB_HOST,
    port: parseInt(env.DB_PORT || '5432'),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('Attempting to connect...');
    const client = await pool.connect();
    console.log('✅ Successfully connected to PostgreSQL!');
    
    console.log('\nTesting query...');
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    console.log('✅ Query successful!');
    console.log('Current Time:', result.rows[0].current_time);
    console.log('PostgreSQL Version:', result.rows[0].version.split(' ').slice(0, 2).join(' '));
    
    console.log('\nChecking for tables...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length > 0) {
      console.log(`✅ Found ${tablesResult.rows.length} table(s):`);
      tablesResult.rows.forEach(row => {
        console.log('  -', row.table_name);
      });
    } else {
      console.log('⚠️  No tables found in public schema');
    }
    
    client.release();
    await pool.end();
    
    console.log('\n✅ All tests passed! Database is ready.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Connection failed:');
    console.error('Error:', error.message);
    if (error.code) {
      console.error('Error Code:', error.code);
    }
    await pool.end();
    process.exit(1);
  }
}

testConnection();
