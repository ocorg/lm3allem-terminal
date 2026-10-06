"use client"

import { useState, type InputHTMLAttributes } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/Input"
import React from "react"

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string
  error?: string
  hint?:  string
}

/**
 * Password field with a show/hide button on the PHYSICAL right (the field is left-to-right, like the
 * text typed in it). Every password box in the app uses this component.
 */
export function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <Input
      dir="ltr"
      autoComplete="off"
      {...props}
      type={visible ? "text" : "password"}
      rightIcon={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          title={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          tabIndex={-1}
          style={{
            pointerEvents: "auto",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            display: "flex",
            padding: 4,
          }}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      }
    />
  )
}
