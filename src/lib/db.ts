import { Pool, PoolClient } from 'pg';

// Create a connection pool to AWS RDS PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  min: 2, // Minimum number of clients
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased to 10 seconds
  query_timeout: 30000, // Query timeout: 30 seconds
  statement_timeout: 30000, // Statement timeout: 30 seconds
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Log connection configuration (without password)
console.log('Database Configuration:', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  ssl: process.env.DB_SSL,
  passwordSet: !!process.env.DB_PASSWORD,
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

// Handle pool connection events
pool.on('connect', (client) => {
  console.log('New client connected to the pool');
});

pool.on('acquire', (client) => {
  console.log('Client acquired from pool');
});

pool.on('remove', (client) => {
  console.log('Client removed from pool');
});

// Export the pool for direct query execution
export const db = pool;

// Helper function to execute queries with automatic connection handling
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  const start = Date.now();
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text: text.substring(0, 100), duration, rows: result.rowCount, attempt });
      return {
        rows: result.rows as T[],
        rowCount: result.rowCount || 0,
      };
    } catch (error) {
      lastError = error;
      console.error(`Database query error (attempt ${attempt}/${maxRetries}):`, error);
      
      // Don't retry on certain errors
      if (error instanceof Error) {
        const errorCode = (error as any).code;
        // Don't retry on syntax errors or constraint violations
        if (errorCode === '42601' || errorCode === '23505' || errorCode === '23503') {
          throw error;
        }
      }
      
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError;
}

// Helper function to get a client for transactions
export async function getClient(): Promise<PoolClient> {
  const client = await pool.connect();
  return client;
}

// Helper function to execute a transaction
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Test connection function
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW() as now');
    console.log('Database connection successful:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}
