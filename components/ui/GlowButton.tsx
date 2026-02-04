import styles from "./GlowButton.module.css";
import clsx from "@/lib/clsx";

export default function GlowButton({
  children,
  className,
  variant = "primary",
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "danger";
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit" | "reset";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={clsx(styles.btn, variant === "danger" && styles.danger, className)}
    >
      {children}
    </button>
  );
}
