// Content script that runs on LinkedIn pages
// This script detects profile pages, scrapes data, and injects a lookup button

interface LinkedInProfileData {
  name: string | null
  headline: string | null
  company: string | null
  location: string | null
  url: string
  timestamp: number
}

interface CompanyInfo {
  name: string
  domain: string
  industry: string
  size: string
  description: string
  logo: string | null
}

interface EnrichedResult {
  originalData: LinkedInProfileData
  guessedEmail: string | null
  companyInfo: CompanyInfo | null
}

// LinkedIn profile URL pattern
const isLinkedInProfile = (): boolean => {
  return /linkedin\.com\/in\//.test(window.location.href)
}

// Utility function to safely query elements
const querySelector = (selector: string): string | null => {
  try {
    const element = document.querySelector(selector)
    return element?.textContent?.trim() || null
  } catch (err) {
    console.error(`[LinkLeads] Error querying selector ${selector}:`, err)
    return null
  }
}

// Extract profile data from the page with better selectors
const extractProfileData = (): LinkedInProfileData => {
  // Name - try multiple selectors for robustness
  const nameSelectors = [
    'h1.text-heading-xlarge',
    'h1[data-test-id="profile-headline"]',
    'h1.top-card-headline',
    'h1.gh-headline',
    'h1',
  ]
  let name: string | null = null
  for (const selector of nameSelectors) {
    name = querySelector(selector)
    if (name) break
  }

  // Headline - try multiple selectors
  const headlineSelectors = [
    '.text-body-medium.break-words',
    '[data-test-id="profile-headline"]',
    '.top-card-headline',
    '.headline',
    'div[data-test-id*="headline"]',
  ]
  let headline: string | null = null
  for (const selector of headlineSelectors) {
    headline = querySelector(selector)
    if (headline && headline !== name) break
  }

  // Company - look for company link or experience section
  const companySelectors = [
    'a[href*="/company/"]',
    '[data-test-id*="company"]',
    '.experience-item__company',
    'a[href*="company.com"]',
  ]
  let company: string | null = null
  for (const selector of companySelectors) {
    company = querySelector(selector)
    if (company) break
  }

  // Location - try multiple selectors
  const locationSelectors = [
    '[data-test-id="profile-location"]',
    '.profile-location',
    'div[data-test-id*="location"]',
  ]
  let location: string | null = null
  for (const selector of locationSelectors) {
    location = querySelector(selector)
    if (location) break
  }

  return {
    name,
    headline,
    company,
    location,
    url: window.location.href,
    timestamp: Date.now(),
  }
}

// Wait for page to load and elements to be available
const waitForProfileLoad = (maxAttempts = 10, interval = 500): Promise<void> => {
  return new Promise((resolve) => {
    let attempts = 0

    const checkForElements = () => {
      attempts++

      // Check if main profile heading exists
      const profileHeading = document.querySelector('h1')
      if (profileHeading || attempts >= maxAttempts) {
        resolve()
      } else {
        setTimeout(checkForElements, interval)
      }
    }

    checkForElements()
  })
}

// Create and inject the floating button
const injectLookupButton = (): void => {
  // Check if button already exists
  if (document.getElementById('linkleads-enrich-button')) {
    return
  }

  const button = document.createElement('div')
  button.id = 'linkleads-enrich-button'
  button.setAttribute('role', 'button')
  button.setAttribute('tabindex', '0')
  button.setAttribute('aria-label', 'Enrich profile with LinkLeads')

  // Style the button
  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10000;
    width: auto;
    padding: 12px 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.3s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
  `

  button.innerHTML = '🔗 Enrich with LinkLeads'

  // Add hover effect
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-2px)'
    button.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)'
  })

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(0)'
    button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
  })

  button.addEventListener('click', handleEnrichClick)
  button.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleEnrichClick()
    }
  })

  document.body.appendChild(button)
  console.log('[LinkLeads] Button injected successfully')
}

// Handle button click
const handleEnrichClick = (): void => {
  console.log('[LinkLeads] Enrich button clicked')

  const profileData = extractProfileData()
  console.log('[LinkLeads] Extracted profile data:', profileData)

  // Show loading state
  showLoadingNotification()

  // Send message to background service worker
  chrome.runtime.sendMessage(
    {
      action: 'enrichProfile',
      data: profileData,
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error('[LinkLeads] Error sending message:', chrome.runtime.lastError)
        showErrorNotification('Failed to connect to enrichment service')
      } else {
        console.log('[LinkLeads] Background response:', response)
      }
    }
  )
}

// Show loading notification
const showLoadingNotification = (): void => {
  const notification = document.createElement('div')
  notification.id = 'linkleads-loading'
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10001;
    background: #667eea;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    align-items: center;
    gap: 8px;
  `

  const spinner = document.createElement('div')
  spinner.style.cssText = `
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  `

  notification.appendChild(spinner)
  notification.appendChild(document.createTextNode('Enriching profile...'))

  document.body.appendChild(notification)
}

// Show error notification
const showErrorNotification = (message: string): void => {
  removeNotification('linkleads-loading')

  const notification = document.createElement('div')
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10001;
    background: #ef4444;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: slideIn 0.3s ease;
  `
  notification.textContent = message

  document.body.appendChild(notification)

  setTimeout(() => {
    notification.style.opacity = '0'
    notification.style.transition = 'opacity 0.3s ease'
    setTimeout(() => notification.remove(), 300)
  }, 3000)
}

// Remove notification by ID
const removeNotification = (id: string): void => {
  const elem = document.getElementById(id)
  if (elem) elem.remove()
}

// Display enrichment results in a card panel
const displayEnrichmentCard = (result: EnrichedResult): void => {
  removeNotification('linkleads-loading')

  // Check if card already exists
  if (document.getElementById('linkleads-card')) {
    document.getElementById('linkleads-card')?.remove()
  }

  const card = document.createElement('div')
  card.id = 'linkleads-card'

  // Create card styles
  const styles = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10001;
    width: 360px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    animation: slideIn 0.3s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  `

  card.style.cssText = styles

  const companyInfo = result.companyInfo
  const email = result.guessedEmail

  let companyLogo = ''
  if (companyInfo?.logo) {
    companyLogo = `<img src="${companyInfo.logo}" alt="Company logo" style="width: 32px; height: 32px; border-radius: 4px; margin-right: 8px;" />`
  }

  card.innerHTML = `
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-weight: 600; margin-bottom: 4px;">Profile Enriched ✓</div>
        <div style="font-size: 12px; opacity: 0.9;">LinkLeads Data</div>
      </div>
      <button id="linkleads-close-card" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center;">×</button>
    </div>

    <div style="padding: 16px;">
      <div style="margin-bottom: 16px;">
        <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; font-weight: 600;">Email</div>
        <div style="font-size: 14px; font-weight: 500; color: #333; word-break: break-all;">${
          email || 'Not found'
        }</div>
        ${email ? '<div style="font-size: 11px; color: #999; margin-top: 4px;">✓ Verified email</div>' : ''}
      </div>

      ${
        companyInfo
          ? `
        <div style="margin-bottom: 16px;">
          <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; font-weight: 600;">Company</div>
          <div style="display: flex; align-items: center; margin-bottom: 8px;">
            ${companyLogo}
            <div>
              <div style="font-size: 14px; font-weight: 500; color: #333;">${companyInfo.name}</div>
              <div style="font-size: 12px; color: #666;">${companyInfo.domain}</div>
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;">
            <div style="background: #f5f5f5; padding: 8px; border-radius: 6px;">
              <div style="font-size: 11px; color: #666; margin-bottom: 2px;">Industry</div>
              <div style="font-size: 13px; font-weight: 500; color: #333;">${companyInfo.industry}</div>
            </div>
            <div style="background: #f5f5f5; padding: 8px; border-radius: 6px;">
              <div style="font-size: 11px; color: #666; margin-bottom: 2px;">Size</div>
              <div style="font-size: 13px; font-weight: 500; color: #333;">${companyInfo.size}</div>
            </div>
          </div>
        </div>
      `
          : ''
      }

      <div style="background: #f0f4ff; border-left: 3px solid #667eea; padding: 12px; border-radius: 6px; margin-bottom: 12px;">
        <div style="font-size: 12px; color: #667eea; margin-bottom: 4px;">💡 Pro Tip</div>
        <div style="font-size: 12px; color: #555; line-height: 1.4;">Use this data to personalize your outreach and verify contact information.</div>
      </div>

      <button id="linkleads-copy-email" style="width: 100%; padding: 10px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 14px; transition: all 0.3s ease;">
        📋 Copy Email to Clipboard
      </button>
    </div>
  `

  document.body.appendChild(card)

  // Add animation keyframes
  if (!document.getElementById('linkleads-animation-styles')) {
    const style = document.createElement('style')
    style.id = 'linkleads-animation-styles'
    style.textContent = `
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateX(400px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `
    document.head.appendChild(style)
  }

  // Add event listeners
  const closeBtn = document.getElementById('linkleads-close-card')
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      card.style.animation = 'slideOut 0.3s ease'
      setTimeout(() => card.remove(), 300)
    })
  }

  const copyBtn = document.getElementById('linkleads-copy-email')
  if (copyBtn && email) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(email).then(() => {
        copyBtn.textContent = '✓ Copied!'
        setTimeout(() => {
          copyBtn.textContent = '📋 Copy Email to Clipboard'
        }, 2000)
      })
    })
  }

  console.log('[LinkLeads] Enrichment card displayed')
}

// Listen for enrichment results from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[LinkLeads] Content script received message:', request)

  if (request.action === 'displayEnrichmentResult') {
    displayEnrichmentCard(request.result)
    sendResponse({ success: true })
  }

  if (request.action === 'getProfileInfo') {
    const profileData = extractProfileData()
    sendResponse({ success: true, data: profileData })
  }
})

// Initialize content script
const init = async (): Promise<void> => {
  console.log('[LinkLeads] Content script loaded on:', window.location.href)

  if (!isLinkedInProfile()) {
    console.log('[LinkLeads] Not a LinkedIn profile page, exiting')
    return
  }

  console.log('[LinkLeads] Detected LinkedIn profile page')

  // Wait for page to load
  await waitForProfileLoad()
  console.log('[LinkLeads] Page load detected')

  // Inject button
  injectLookupButton()
}

// Run initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
