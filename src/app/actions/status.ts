'use server'

import { supabase } from '@/lib/supabase';

export async function getHunterStatus() {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) {
    return { status: 'Missing Key', credits: null };
  }

  try {
    const res = await fetch(`https://api.hunter.io/v2/account?api_key=${apiKey}`, {
      next: { revalidate: 60 } // Cache for 60 seconds
    });
    
    if (!res.ok) {
      return { status: 'Error', credits: null };
    }

    const data = await res.json();
    const used = data?.data?.requests?.searches?.used || 0;
    const available = data?.data?.requests?.searches?.available || 0;

    return { 
      status: 'Connected', 
      credits: `${used} / ${available}` 
    };
  } catch (error) {
    return { status: 'Disconnected', credits: null };
  }
}

export async function getSupabaseStatus() {
  try {
    // A lightweight ping to verify Supabase connectivity
    // Using a simple auth check (or you can query a public table if you prefer)
    const { error } = await supabase.auth.getSession();
    
    if (error) {
      return { status: 'Error' };
    }

    return { status: 'Connected' };
  } catch (error) {
    return { status: 'Disconnected' };
  }
}
