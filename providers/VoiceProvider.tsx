'use client'

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react'

interface VoiceCommand {
  command: string
  confidence: number
  timestamp: Date
}

interface VoiceProviderState {
  isListening: boolean
  isSupported: boolean
  isEnabled: boolean
  lastCommand: VoiceCommand | null
  error: string | null
  confidence: number
}

interface VoiceProviderContext extends VoiceProviderState {
  startListening: () => void
  stopListening: () => void
  toggleListening: () => void
  setEnabled: (enabled: boolean) => void
  registerCommand: (pattern: string | RegExp, callback: (command: string, confidence: number) => void) => () => void
}

const VoiceContext = createContext<VoiceProviderContext | undefined>(undefined)

interface VoiceProviderProps {
  children: ReactNode
  language?: string
  continuous?: boolean
  interimResults?: boolean
  maxAlternatives?: number
  confidenceThreshold?: number
}

export function VoiceProvider({ 
  children, 
  language = 'en-US',
  continuous = true,
  interimResults = false,
  maxAlternatives = 1,
  confidenceThreshold = 0.6
}: VoiceProviderProps) {
  const [state, setState] = useState<VoiceProviderState>({
    isListening: false,
    isSupported: false,
    isEnabled: true,
    lastCommand: null,
    error: null,
    confidence: 0
  })

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const commandHandlersRef = useRef<Map<string | RegExp, (command: string, confidence: number) => void>>(new Map())
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    // Check for Web Speech API support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      
      recognition.continuous = continuous
      recognition.interimResults = interimResults
      recognition.lang = language
      recognition.maxAlternatives = maxAlternatives

      recognition.onstart = () => {
        setState(prev => ({ ...prev, isListening: true, error: null }))
      }

      recognition.onend = () => {
        setState(prev => ({ ...prev, isListening: false }))
      }

      recognition.onerror = (event) => {
        let errorMessage = 'Speech recognition error'
        
        switch (event.error) {
          case 'no-speech':
            errorMessage = 'No speech detected'
            break
          case 'audio-capture':
            errorMessage = 'Audio capture failed'
            break
          case 'not-allowed':
            errorMessage = 'Microphone access denied'
            break
          case 'network':
            errorMessage = 'Network error'
            break
          default:
            errorMessage = `Speech recognition error: ${event.error}`
        }

        setState(prev => ({ 
          ...prev, 
          error: errorMessage, 
          isListening: false 
        }))
      }

      recognition.onresult = (event) => {
        const lastResult = event.results[event.results.length - 1]
        const transcript = lastResult[0].transcript.trim().toLowerCase()
        const confidence = lastResult[0].confidence || 0

        if (confidence >= confidenceThreshold) {
          const command: VoiceCommand = {
            command: transcript,
            confidence,
            timestamp: new Date()
          }

          setState(prev => ({ 
            ...prev, 
            lastCommand: command, 
            confidence,
            error: null 
          }))

          // Process command handlers
          commandHandlersRef.current.forEach((handler, pattern) => {
            let matches = false
            
            if (typeof pattern === 'string') {
              matches = transcript.includes(pattern.toLowerCase())
            } else if (pattern instanceof RegExp) {
              matches = pattern.test(transcript)
            }
            
            if (matches) {
              handler(transcript, confidence)
            }
          })
        }
      }

      recognitionRef.current = recognition
      setState(prev => ({ ...prev, isSupported: true }))
    } else {
      setState(prev => ({ 
        ...prev, 
        isSupported: false, 
        error: 'Speech recognition not supported in this browser' 
      }))
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [language, continuous, interimResults, maxAlternatives, confidenceThreshold])

  const startListening = () => {
    if (!state.isSupported || !state.isEnabled || !recognitionRef.current) return

    try {
      recognitionRef.current.start()
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to start speech recognition' 
      }))
    }
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }

  const toggleListening = () => {
    if (state.isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  const setEnabled = (enabled: boolean) => {
    setState(prev => ({ ...prev, isEnabled: enabled }))
    if (!enabled && state.isListening) {
      stopListening()
    }
  }

  const registerCommand = (
    pattern: string | RegExp, 
    callback: (command: string, confidence: number) => void
  ) => {
    commandHandlersRef.current.set(pattern, callback)
    
    // Return cleanup function
    return () => {
      commandHandlersRef.current.delete(pattern)
    }
  }

  const contextValue: VoiceProviderContext = {
    ...state,
    startListening,
    stopListening,
    toggleListening,
    setEnabled,
    registerCommand
  }

  return (
    <VoiceContext.Provider value={contextValue}>
      {children}
      <VoiceFeedbackUI />
    </VoiceContext.Provider>
  )
}

// Visual feedback component
function VoiceFeedbackUI() {
  const voice = useVoice()
  const [showFeedback, setShowFeedback] = useState(false)

  useEffect(() => {
    if (voice.isListening || voice.lastCommand) {
      setShowFeedback(true)
      
      if (voice.lastCommand) {
        const timer = setTimeout(() => {
          setShowFeedback(false)
        }, 3000)
        
        return () => clearTimeout(timer)
      }
    } else {
      setShowFeedback(false)
    }
  }, [voice.isListening, voice.lastCommand])

  if (!voice.isSupported || !showFeedback) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 50 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-xl max-w-sm">
          <div className="flex items-center space-x-3">
            <div className="relative">
              {voice.isListening ? (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <Mic className="h-4 w-4 text-white" />
                </motion.div>
              ) : (
                <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center">
                  <MicOff className="h-4 w-4 text-gray-400" />
                </div>
              )}
            </div>
            
            <div className="flex-1">
              {voice.isListening ? (
                <div>
                  <p className="text-white text-sm font-medium">Listening...</p>
                  <p className="text-gray-400 text-xs">Say a command</p>
                </div>
              ) : voice.lastCommand ? (
                <div>
                  <p className="text-white text-sm font-medium">Command Received</p>
                  <p className="text-blue-400 text-xs">"{voice.lastCommand.command}"</p>
                  <p className="text-gray-400 text-xs">
                    Confidence: {Math.round(voice.lastCommand.confidence * 100)}%
                  </p>
                </div>
              ) : null}
            </div>
          </div>
          
          {voice.error && (
            <div className="mt-2 p-2 bg-red-900 border border-red-700 rounded text-red-200 text-xs">
              {voice.error}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

export function useVoice() {
  const context = useContext(VoiceContext)
  if (context === undefined) {
    throw new Error('useVoice must be used within a VoiceProvider')
  }
  return context
}

// Quick commands component for UI
interface VoiceCommandButtonProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function VoiceCommandButton({ className = '', size = 'md' }: VoiceCommandButtonProps) {
  const voice = useVoice()

  if (!voice.isSupported) return null

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  }

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  }

  return (
    <button
      onClick={voice.toggleListening}
      disabled={!voice.isEnabled}
      className={`
        ${sizeClasses[size]} 
        ${voice.isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'} 
        ${!voice.isEnabled ? 'opacity-50 cursor-not-allowed' : ''} 
        rounded-full flex items-center justify-center transition-colors
        ${className}
      `}
      title={voice.isListening ? 'Stop listening' : 'Start voice commands'}
    >
      {voice.isListening ? (
        <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
          <Mic className={`${iconSizes[size]} text-white`} />
        </motion.div>
      ) : (
        <MicOff className={`${iconSizes[size]} text-gray-300`} />
      )}
    </button>
  )
}

// Available commands display component
export function VoiceCommandsList({ commands }: { commands: string[] }) {
  const voice = useVoice()

  if (!voice.isSupported || !voice.isEnabled) return null

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <h3 className="text-white font-medium mb-3 flex items-center">
        <Volume2 className="h-4 w-4 mr-2" />
        Voice Commands
      </h3>
      <div className="space-y-2">
        {commands.map((command, index) => (
          <div key={index} className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
            <code className="text-sm text-blue-300 bg-gray-900 px-2 py-1 rounded">
              "{command}"
            </code>
          </div>
        ))}
      </div>
    </div>
  )
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}