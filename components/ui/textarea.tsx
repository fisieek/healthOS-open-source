import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-[#2e3229] bg-[#0d0e0c] px-3 py-2 text-sm text-[#f1f2ec] shadow-sm transition-colors placeholder-[#5d6050] focus:border-[#bce663] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 resize-none font-sans",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
