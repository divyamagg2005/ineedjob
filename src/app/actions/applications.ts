'use server'

import { query } from '@/lib/db';

interface InsertApplicationParams {
  user_email: string;
  company_name: string;
  recipient_email: string;
  resume_file: string | null;
}

export async function insertApplication(params: InsertApplicationParams) {
  try {
    const { user_email, company_name, recipient_email, resume_file } = params;
    
    const result = await query(
      `INSERT INTO applications (user_email, company_name, recipient_email, resume_file, created_at) 
       VALUES ($1, $2, $3, $4, NOW()) 
       RETURNING id`,
      [user_email, company_name, recipient_email, resume_file]
    );

    return { success: true, id: result.rows[0]?.id };
  } catch (error) {
    console.error('Error inserting application:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
