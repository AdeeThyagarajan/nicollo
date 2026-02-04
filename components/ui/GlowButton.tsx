import React from "react";
import styles from "./GlowButton.module.css";

type GlowButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
};

export default function GlowButton({
  children,
  onClick,
  disabled = false,
  className,
}: GlowButtonProps) {
  return (
    <button
      className={`${styles.button} ${className ?? ""} ${
        disabled ? styles.disabled : ""
      }`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
