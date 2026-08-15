// Discord-style presence dot — pair with an `.avatar-status` wrapper around
// the avatar element so it can sit outside the avatar's own overflow:hidden
// (see site.css). Green when online, a hollow ring with an X when not.
export function StatusDot({
  online,
  onSidebar = false,
  size = "md",
}: {
  online: boolean;
  onSidebar?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={`avatar-status__dot${
        online ? " avatar-status__dot--online" : " avatar-status__dot--offline"
      }${onSidebar ? " avatar-status__dot--on-sidebar" : ""}${
        size === "sm" ? " avatar-status__dot--sm" : ""
      }`}
      aria-hidden="true"
      title={online ? "Online" : "Offline"}
    >
      {!online && "✕"}
    </span>
  );
}
