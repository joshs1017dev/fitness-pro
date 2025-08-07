'use client'

import { useEffect, ReactNode, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { logger, logUserAction } from '@/lib/logger'
import { useAuth } from './AuthProvider'

/**
 * Client-side monitoring provider for error tracking and performance monitoring
 */

interface MonitoringProviderProps {
  children: ReactNode
}

export function MonitoringProvider({ children }: MonitoringProviderProps) {
  const pathname = usePathname()
  const { user } = useAuth()

  // Track page views
  useEffect(() => {
    logUserAction('page_view', {
      path: pathname,
      title: document.title,
      referrer: document.referrer,
    })
  }, [pathname])

  // Track performance metrics
  useEffect(() => {
    // Core Web Vitals
    if ('PerformanceObserver' in window) {
      try {
        // Largest Contentful Paint
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1] as any
          logger.trackPerformance('LCP', lastEntry.renderTime || lastEntry.loadTime, {
            path: pathname,
            element: lastEntry.element?.tagName,
          })
        })
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })

        // First Input Delay
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry: any) => {
            logger.trackPerformance('FID', entry.processingStart - entry.startTime, {
              path: pathname,
              eventType: entry.name,
            })
          })
        })
        fidObserver.observe({ entryTypes: ['first-input'] })

        // Cumulative Layout Shift
        let clsValue = 0
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value
            }
          })
          logger.trackPerformance('CLS', clsValue, { path: pathname })
        })
        clsObserver.observe({ entryTypes: ['layout-shift'] })

        return () => {
          lcpObserver.disconnect()
          fidObserver.disconnect()
          clsObserver.disconnect()
        }
      } catch (e) {
        // Performance Observer not supported
      }
    }
  }, [pathname])

  // Track user interactions
  const trackClick = useCallback((event: MouseEvent) => {
    const target = event.target as HTMLElement
    const isTracked = target.closest('[data-track]')
    
    if (isTracked) {
      const trackData = isTracked.getAttribute('data-track')
      logUserAction('click', {
        element: trackData,
        text: isTracked.textContent?.slice(0, 50),
        path: pathname,
      })
    }
  }, [pathname])

  useEffect(() => {
    document.addEventListener('click', trackClick)
    return () => document.removeEventListener('click', trackClick)
  }, [trackClick])

  // Track form submissions
  const trackFormSubmit = useCallback((event: Event) => {
    const form = event.target as HTMLFormElement
    const formName = form.getAttribute('data-form-name') || form.name || 'unknown'
    
    logUserAction('form_submit', {
      formName,
      path: pathname,
    })
  }, [pathname])

  useEffect(() => {
    document.addEventListener('submit', trackFormSubmit)
    return () => document.removeEventListener('submit', trackFormSubmit)
  }, [trackFormSubmit])

  // Monitor network activity
  useEffect(() => {
    const originalFetch = window.fetch
    
    window.fetch = async function(...args) {
      const startTime = Date.now()
      const [resource, config] = args
      const url = typeof resource === 'string' ? resource : resource.url
      
      try {
        const response = await originalFetch.apply(this, args)
        const duration = Date.now() - startTime
        
        // Log slow requests
        if (duration > 1000) {
          logger.warn('Slow network request', {
            url,
            duration,
            status: response.status,
          })
        }
        
        // Log errors
        if (!response.ok) {
          logger.error('Network request failed', {
            url,
            status: response.status,
            statusText: response.statusText,
          })
        }
        
        return response
      } catch (error) {
        const duration = Date.now() - startTime
        logger.error('Network request error', {
          url,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        throw error
      }
    }
    
    return () => {
      window.fetch = originalFetch
    }
  }, [])

  // Track memory usage
  useEffect(() => {
    if ('performance' in window && 'memory' in performance) {
      const checkMemory = () => {
        const memory = (performance as any).memory
        const usedMB = Math.round(memory.usedJSHeapSize / 1048576)
        const totalMB = Math.round(memory.totalJSHeapSize / 1048576)
        
        if (usedMB > totalMB * 0.9) {
          logger.warn('High memory usage', {
            used: usedMB,
            total: totalMB,
            percentage: Math.round((usedMB / totalMB) * 100),
          })
        }
      }
      
      const interval = setInterval(checkMemory, 30000) // Check every 30 seconds
      return () => clearInterval(interval)
    }
  }, [])

  // Add user context to logs
  useEffect(() => {
    if (user) {
      // This would normally be set globally for all logs
      // For this implementation, we'll track login
      logUserAction('user_session_start', {
        userId: user.id,
        email: user.email,
      })
    }
  }, [user])

  return <>{children}</>
}

// Hook for manual tracking
export function useTracking() {
  const pathname = usePathname()
  
  const trackEvent = useCallback((event: string, properties?: any) => {
    logUserAction(event, {
      ...properties,
      path: pathname,
      timestamp: Date.now(),
    })
  }, [pathname])
  
  const trackTiming = useCallback((category: string, variable: string, value: number) => {
    logger.trackPerformance(`${category}.${variable}`, value, {
      path: pathname,
    })
  }, [pathname])
  
  return { trackEvent, trackTiming }
}