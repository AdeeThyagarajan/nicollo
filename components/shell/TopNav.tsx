import styles from "./TopNav.module.css";
import StatusPill from "@/components/ui/StatusPill";

export default function TopNav({
  title,
  status,
}: {
  title?: string;
  status?: string;
}) {
  const showTitle = Boolean(title && title.trim());
  const showStatus = Boolean(status && status.trim());

  return (
    <div className={styles.nav}>
      <div className={styles.left}>
        <div className={styles.logoMark} />
        <div className={styles.logoText}>Devassist</div>

        {showTitle ? <div className={styles.sep} /> : null}
        {showTitle ? <div className={styles.pageTitle}>{title}</div> : null}
        {showStatus ? (
          <StatusPill className={styles.status} label={status!} />
        ) : null}
      </div>

      <div className={styles.right}>
        <div className={styles.planet} />
      </div>
    </div>
  );
}
