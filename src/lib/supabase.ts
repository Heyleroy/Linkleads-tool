import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
// Replace these with your actual Supabase project details
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storageKey: 'linkleads_session',
    storage: {
      getItem: (key: string) => {
        return new Promise((resolve) => {
          chrome.storage.local.get(key, (items) => {
            resolve(items[key] || null)
          })
        })
      },
      setItem: (key: string, value: string) => {
        return new Promise((resolve) => {
          chrome.storage.local.set({ [key]: value }, () => {
            resolve()
          })
        })
      },
      removeItem: (key: string) => {
        return new Promise((resolve) => {
          chrome.storage.local.remove(key, () => {
            resolve()
          })
        })
      },
    },
  },
})
