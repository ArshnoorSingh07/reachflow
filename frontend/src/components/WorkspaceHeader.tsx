import type { User } from "../types";
import { AccountMenu } from "./AccountMenu";
export function WorkspaceHeader({
  user,
  title,
  onLogout,
}: {
  user: User;
  title: string;
  onLogout: (all: boolean) => Promise<void>;
}) {
  return (
    <header className="workspace-header" aria-label={title}>
      <div className="workspace-profile">
        <AccountMenu user={user} onLogout={onLogout} />
      </div>
    </header>
  );
}
