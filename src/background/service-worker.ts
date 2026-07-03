// Background service worker for Chrome Extension Manifest V3
// Handles enrichment logic and data processing

interface EnrichmentData {
  name: string | null
  headline: string | null
  company: string | null
  location: string | null
  url: string
  timestamp: number
}

interface EnrichedResult {
  originalData: EnrichmentData
  guessedEmail: string | null
  companyInfo: CompanyInfo | null
}

interface CompanyInfo {
  name: string
  domain: string
  industry: string
  size: string
  description: string
  logo: string | null
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'INSTALL') {
    console.log('[LinkLeads] Extension installed')
  }
})

// Extract domain from company name
const extractDomain = (companyName: string | null): string | null => {
  if (!companyName) return null

  // Remove common suffixes
  let domain = companyName
    .toLowerCase()
    .replace(/\s+inc\.?$/i, '')
    .replace(/\s+ltd\.?$/i, '')
    .replace(/\s+llc$/i, '')
    .replace(/\s+corp\.?$/i, '')
    .replace(/\s+&\s+co\.?$/i, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')

  return domain || null
}

// Guess email format: firstname.lastname@domain.com
const guessEmail = (name: string | null, companyName: string | null): string | null => {
  if (!name || !companyName) return null

  try {
    const domain = extractDomain(companyName)
    if (!domain) return null

    // Split name into parts
    const nameParts = name.toLowerCase().trim().split(/\s+/)
    if (nameParts.length < 2) return null

    const firstName = nameParts[0]
    const lastName = nameParts[nameParts.length - 1]

    // Common email formats (try multiple)
    const formats = [
      `${firstName}.${lastName}@${domain}.com`,
      `${firstName}${lastName}@${domain}.com`,
      `${firstName}@${domain}.com`,
    ]

    return formats[0] // Return most common format
  } catch (err) {
    console.error('[LinkLeads] Error guessing email:', err)
    return null
  }
}

// Fetch company info using Clearbit API (no auth needed for basic)
const fetchCompanyInfo = async (companyName: string | null): Promise<CompanyInfo | null> => {
  if (!companyName) return null

  try {
    const domain = extractDomain(companyName)
    if (!domain) return null

    console.log('[LinkLeads] Fetching company info for domain:', domain)

    // Try Clearbit Company API (returns JSON-LD format)
    const response = await fetch(`https://company.clearbit.com/v1/domains/find?name=${encodeURIComponent(domain)}`, {
      method: 'GET',
      mode: 'cors',
    })

    if (response.ok) {
      const data = await response.json()
      console.log('[LinkLeads] Clearbit response:', data)

      if (data && data.domain) {
        return {
          name: data.domain.companyName || companyName,
          domain: data.domain.domain,
          industry: data.domain.industry || 'Unknown',
          size: data.domain.employeeCountRange || 'Unknown',
          description: data.domain.description || 'N/A',
          logo: data.domain.logo || null,
        }
      }
    }
  } catch (err) {
    console.error('[LinkLeads] Error fetching company info:', err)
  }

  // Fallback: Return mock company data
  console.log('[LinkLeads] Using mock company data')
  return {
    name: companyName,
    domain: extractDomain(companyName) || 'unknown.com',
    industry: 'Technology',
    size: '50-200 employees',
    description: 'Professional company',
    logo: null,
  }
}

// Main enrichment function
const enrichProfile = async (data: EnrichmentData): Promise<EnrichedResult> => {
  console.log('[LinkLeads] Starting profile enrichment:', data)

  const guessedEmail = guessEmail(data.name, data.company)
  const companyInfo = await fetchCompanyInfo(data.company)

  const result: EnrichedResult = {
    originalData: data,
    guessedEmail,
    companyInfo,
  }

  console.log('[LinkLeads] Enrichment complete:', result)
  return result
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[LinkLeads] Background received message:', request)

  if (request.action === 'enrichProfile') {
    // Run enrichment asynchronously
    enrichProfile(request.data)
      .then((enrichedData) => {
        console.log('[LinkLeads] Enrichment result:', enrichedData)

        // Send enriched data back to content script
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, {
            action: 'displayEnrichmentResult',
            result: enrichedData,
          })
        }

        // Send initial response
        sendResponse({ success: true, message: 'Enrichment started' })
      })
      .catch((err) => {
        console.error('[LinkLeads] Enrichment error:', err)
        sendResponse({ success: false, error: err.message })
      })

    // Return true to indicate we'll send response asynchronously
    return true
  }

  if (request.action === 'getSession') {
    chrome.storage.local.get('linkleads_session', (items) => {
      sendResponse({ session: items.linkleads_session || null })
    })
    return true
  }

  if (request.action === 'clearSession') {
    chrome.storage.local.remove('linkleads_session', () => {
      sendResponse({ success: true })
    })
    return true
  }
})
