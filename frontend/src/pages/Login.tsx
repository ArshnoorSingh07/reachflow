import {
  ArrowRight,
  ArrowUpRight,
  Send,
  Check,
  ShieldCheck,
  Clock3,
  Layers3,
} from "lucide-react";
export function Login({
  preview,
  error,
}: {
  preview: () => void;
  error: string;
}) {
  return (
    <main className="login">
      <div className="login-brand">
        <span className="logo">
          <Send size={21} />
        </span>
        <span>
          reachflow<span className="brand-dot">.</span>
        </span>
      </div>
      <div className="login-content">
        <div className="eyebrow">
          <span className="tiny-line" />A LITTLE TIMING. A LOT OF POSSIBILITY.
        </div>
        <h1>
          Good emails.
          <br />
          <span>Perfect timing.</span>
        </h1>
        <p>
          The thoughtful way to send at scale.
          <br />
          Plan your outreach. Make room for connection.
        </p>
        <a className="primary google" href="/auth/google">
          <span className="google-g">G</span>Continue with Google
          <ArrowRight size={17} />
        </a>
        <button className="text-button" onClick={preview}>
          Take a look around
          <ArrowUpRight size={15} />
        </button>
        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}
        <div className="login-trust">
          <ShieldCheck size={15} />
          <span>Secure Google sign-in. No extra passwords.</span>
        </div>
        <small>
          The preview uses sample data. Sign in to start scheduling.
        </small>
      </div>
      <div className="login-art">
        <div className="art-grid" />
        <div className="orb" />
        <div className="floating-card">
          <div className="art-card-header">
            <span className="art-mark">
              <Send size={16} />
            </span>
            <span>YOUR NEXT CONVERSATION</span>
            <span className="art-ellipsis">•••</span>
          </div>
          <span className="success-circle">
            <Check size={25} />
          </span>
          <strong>
            Right message.
            <br />
            Right moment.
          </strong>
          <p>A thoughtful hello can go a long way.</p>
          <div className="art-recipient">
            <span>O</span>
            <div>
              <strong>Olivia Chen</strong>
              <small>olivia@northstar.co</small>
            </div>
            <span className="art-check">
              <Check size={14} />
            </span>
          </div>
          <div className="art-status">
            <Clock3 size={14} />
            <span>Tomorrow, 9:00 AM</span>
            <span className="mini-badge">Scheduled</span>
          </div>
        </div>
        <div className="floating-chip">
          <Layers3 size={17} />
          <span>
            One workspace.<strong>Every connection.</strong>
          </span>
          <span className="dot" />
        </div>
        <span className="art-caption">
          THOUGHTFUL OUTREACH, BEAUTIFULLY ORCHESTRATED.
        </span>
      </div>
      <div className="login-footer">
        Made for meaningful connections.
        <span>Reachflow © {new Date().getFullYear()}</span>
      </div>
    </main>
  );
}
