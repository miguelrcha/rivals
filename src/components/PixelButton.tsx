import { ButtonHTMLAttributes } from "react";

type PixelButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "outline";
};

export function PixelButton({
  children,
  variant = "outline",
  className,
  ...props
}: PixelButtonProps) {
  return (
    <button
      className={`pixel-btn pixel-btn--${variant} ${className ?? ""}`}
      {...props}
    >
      {children}
    </button>
  );
}
