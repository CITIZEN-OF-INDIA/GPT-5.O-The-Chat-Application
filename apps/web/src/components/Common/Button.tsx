import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost";
}

export default function Button({
  children,
  variant = "primary",
  style,
  ...props
}: ButtonProps) {
  const baseStyle: React.CSSProperties = {
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 500,
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: "#25d366", // WhatsApp green
      color: "#111b21",
    },
    ghost: {
      backgroundColor: "transparent",
      color: "#8696a0",
    },
  };

  return (
    <button
      {...props}
      style={{
        ...baseStyle,
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}
