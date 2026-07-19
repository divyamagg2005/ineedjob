import { Pool, PoolClient } from 'pg';

// Create a connection pool to AWS RDS PostgreSQL with robust settings
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  
  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  min: 2, // Minimum number of clients to keep alive
  idleTimeoutMillis: 10000, // Close idle clients after 10 seconds
  connectionTimeoutMillis: 10000, // Wait 10 seconds for new connection
  
  // Query timeouts
  query_timeout: 30000, // 30 seconds
  statement_timeout: 30000, // 30 seconds
  
  // Keep-alive to prevent connection drops
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  
  // Allow the pool to automatically remove broken connections
  allowExitOnIdle: false,
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

// Handle pool errors - remove bad clients automatically
pool.on('error', (err, client) => {
  console.error('Unexpected pool error:', err.message);
  // The pool will automatically remove the client and create a new one
});

// Export the pool for direct query execution
export const db = pool;

// Helper function to validate and reconnect if needed
async function getHealthyClient(): Promise<PoolClient> {
  const maxAttempts = 3;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const client = await pool.connect();
      
      // Test if the connection is actually alive
      try {
        await client.query('SELECT 1');
        return client; // Connection is healthy
      } catch (testError) {
        // Connection is broken, release it and try again
        console.error(`Connection test failed (attempt ${attempt}/${maxAttempts}):`, testError);
        client.release(true); // Force remove this broken connection
        
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        throw testError;
      }
    } catch (error) {
      console.error(`Failed to get client (attempt ${attempt}/${maxAttempts}):`, error);
      if (attempt === maxAttempts) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  throw new Error('Failed to get healthy database connection');
}

// Helper function to execute queries with automatic reconnection and retry
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  const start = Date.now();
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let client: PoolClient | null = null;
    
    try {
      // Get a healthy client
      client = await getHealthyClient();
      
      // Execute the query
      const result = await client.query(text, params);
      const duration = Date.now() - start;
      
      console.log('Query executed successfully', { 
        query: text.substring(0, 50) + '...', 
        duration, 
        rows: result.rowCount,
        attempt 
      });
      
      return {
        rows: result.rows as T[],
        rowCount: result.rowCount || 0,
      };
    } catch (error) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Query error (attempt ${attempt}/${maxRetries}):`, errorMessage);
      
      // Check if it's a connection error that we should retry
      const isRetriableError = 
        errorMessage.includes('Connection terminated') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('timeout');
      
      // Don't retry on SQL syntax errors or constraint violations
      if (error instanceof Error) {
        const errorCode = (error as any).code;
        if (errorCode === '42601' || errorCode === '23505' || errorCode === '23503') {
          throw error; // These are code bugs, not connection issues
        }
      }
      
      // If not retriable or last attempt, throw the error
      if (!isRetriableError || attempt === maxRetries) {
        throw lastError;
      }
      
      // Wait before retrying with exponential backoff
      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
    } finally {
      // Always release the client back to the pool
      if (client) {
        client.release();
      }
    }
  }
  
  throw lastError;
}

// Helper function to get a client for transactions
export async function getClient(): Promise<PoolClient> {
  return await getHealthyClient();
}

// Helper function to execute a transaction with automatic retry
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const client = await getHealthyClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      lastError = error;
      
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Transaction error (attempt ${attempt}/${maxRetries}):`, errorMessage);
      
      // Check if it's a connection error
      const isRetriableError = 
        errorMessage.includes('Connection terminated') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ETIMEDOUT');
      
      if (!isRetriableError || attempt === maxRetries) {
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    } finally {
      client.release();
    }
  }
  
  throw lastError;
}

// Test connection function with better error handling
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW() as now, version() as version');
    console.log('✅ Database connection successful');
    console.log('   Server time:', result.rows[0].now);
    console.log('   PostgreSQL:', result.rows[0].version.split(' ').slice(0, 2).join(' '));
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

// Graceful shutdown
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('Database pool closed');
}
