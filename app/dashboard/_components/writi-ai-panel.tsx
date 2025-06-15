"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Sparkles,
  Send,
  Mic,
  Plus,
  Target,
  BookOpen,
  Lightbulb,
  Edit3,
  Globe,
  AtSign,
  TrendingUp,
  MapPin
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

const quickPrompts = [
  "make a video script in 60 seconds",
  "Edit my Writing",
  "Generate 50+ ideas",
  "Give me a summary of my notes"
]

export function WritiAiPanel() {
  const [prompt, setPrompt] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSubmit = async () => {
    if (!prompt.trim()) return

    setIsLoading(true)
    // Simulate AI processing
    setTimeout(() => {
      setIsLoading(false)
      setPrompt("")
    }, 2000)
  }

  const handleQuickPrompt = (promptText: string) => {
    setPrompt(promptText)
  }

  if (!mounted) {
    return (
      <div
        className="flex w-80 flex-col border-l"
        style={{
          backgroundColor: "var(--color-bg-secondary)",
          borderColor: "var(--color-border-light)"
        }}
      >
        <div
          className="flex items-center justify-between border-b p-6"
          style={{ borderColor: "var(--color-border-light)" }}
        >
          <h2
            className="figma-text-primary text-lg"
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: "var(--font-weight-semibold)"
            }}
          >
            Writi AI
          </h2>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex w-80 flex-col border-l"
      style={{
        backgroundColor: "var(--color-bg-secondary)",
        borderColor: "var(--color-border-light)"
      }}
    >
      {/* Header */}
      <div
        className="border-b px-6 py-4"
        style={{ borderColor: "var(--color-border-light)" }}
      >
        <h2
          className="figma-text-primary text-lg"
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: "var(--font-weight-semibold)",
            fontSize: "18px"
          }}
        >
          Writi AI
        </h2>
      </div>

      {/* Ask Me Anything Section */}
      <div className="p-6">
        <h3
          className="figma-text-primary mb-6 text-center text-xl"
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: "var(--font-weight-semibold)",
            fontSize: "20px",
            lineHeight: "var(--line-height-tight)"
          }}
        >
          Ask me Anything
        </h3>

        {/* Pill Buttons */}
        <div className="mb-3 grid grid-cols-3 gap-2">
          <Button
            size="sm"
            className="h-8 rounded-full px-3 py-2 text-xs"
            style={{
              backgroundColor: "var(--color-text-primary)",
              color: "var(--color-bg-secondary)",
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              fontSize: "12px"
            }}
          >
            <Plus className="mr-1 size-3" />
            Create
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="figma-text-secondary h-8 rounded-full px-3 py-2 text-xs"
            style={{
              borderColor: "var(--color-border-medium)",
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              fontSize: "12px"
            }}
          >
            <TrendingUp className="mr-1 size-3" />
            Market
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="figma-text-secondary h-8 rounded-full px-3 py-2 text-xs"
            style={{
              borderColor: "var(--color-border-medium)",
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              fontSize: "12px"
            }}
          >
            <MapPin className="mr-1 size-3" />
            Plan
          </Button>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="figma-text-secondary h-8 w-full rounded-full text-xs"
          style={{
            borderColor: "var(--color-border-medium)",
            fontFamily: "var(--font-body)",
            fontWeight: 500,
            fontSize: "12px"
          }}
        >
          <BookOpen className="mr-2 size-3" />
          Learn
        </Button>
      </div>

      {/* Prompt Shortcuts */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="space-y-3">
          {quickPrompts.map((promptText, index) => (
            <motion.div
              key={promptText}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="group cursor-pointer"
              onClick={() => handleQuickPrompt(promptText)}
            >
              <div
                className="rounded-lg border p-3 transition-all duration-200"
                style={{
                  backgroundColor: "var(--color-bg-tertiary)",
                  borderColor: "var(--color-border-light)"
                }}
              >
                <p
                  className="figma-text-primary text-sm"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontWeight: 500,
                    fontSize: "14px"
                  }}
                >
                  {promptText}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Context Input Area */}
      <div
        className="border-t p-6"
        style={{
          borderColor: "var(--color-border-light)",
          backgroundColor: "var(--color-bg-tertiary)"
        }}
      >
        {/* Add Context Button */}
        <div className="mb-4">
          <Button
            variant="outline"
            size="sm"
            className="figma-text-secondary h-7 rounded-full px-3 text-xs"
            style={{
              borderColor: "var(--color-border-medium)",
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              fontSize: "11px"
            }}
          >
            <Plus className="mr-1 size-3" />
            add context
          </Button>
        </div>

        {/* Chat Input */}
        <div className="relative">
          <Textarea
            placeholder="Ask AI anything, @mention"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            className="figma-text-primary min-h-[80px] resize-none rounded-lg pr-16"
            style={{
              backgroundColor: "var(--color-bg-secondary)",
              borderColor: "var(--color-border-medium)",
              fontFamily: "var(--font-body)",
              fontSize: "14px"
            }}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
          />

          <div className="absolute bottom-3 right-3 flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="figma-text-secondary size-6 hover:text-gray-700"
            >
              <Globe className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="figma-text-secondary size-6 hover:text-gray-700"
            >
              <Mic className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
