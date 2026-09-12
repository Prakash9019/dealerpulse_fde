/* Templates re-mount on every navigation (unlike layout.tsx), which is exactly
   what a per-page entrance transition needs. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="dp-in">{children}</div>;
}
