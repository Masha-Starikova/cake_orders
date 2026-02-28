import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type PrimaryButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>;

export function PrimaryButton({ children, className, ...props }: PrimaryButtonProps) {
  return (
    <button className={["btn", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </button>
  );
}
