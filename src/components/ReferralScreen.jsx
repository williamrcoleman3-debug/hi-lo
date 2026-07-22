import { useState } from "react";
import { useThemeTokens } from "../themes/ThemeContext";
import { buildShareUrl, shareResult } from "../share/share.js";

export function ReferralScreen({ userId, profile }) {
  const C = useThemeTokens();
  const [inviteNotice, setInviteNotice] = useState(null);

  const inviteUrl = profile?.username ? buildShareUrl(profile.username) : null;

  const handleInvite = async () => {
    const result = await shareResult("Play Higher · Lower · Same with me — sign up with my link.", inviteUrl);
    if (result === "copied") {
      setInviteNotice("Copied to clipboard!");
      setTimeout(() => setInviteNotice(null), 2000);
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-4xl mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ fontFamily: "'Fraunces', serif" }}>
          Referrals
        </h1>
        <p className="text-sm mt-1" style={{ color: C.textSecondary }}>
          Earn 5 lifelines when a friend signs up with your link and plays their first game — win or bust, either
          counts.
        </p>
      </div>

      {!userId ? (
        <div className="w-full max-w-4xl rounded-xl p-6 text-sm text-center" style={{ border: `1px solid ${C.border}`, color: C.textMuted }}>
          Sign in to get your invite link.
        </div>
      ) : (
        <>
          <div className="w-full max-w-4xl rounded-xl p-4 mb-6" style={{ border: `1px solid ${C.border}` }}>
            <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: C.textMuted }}>
              Your invite link
            </div>
            <div
              className="rounded-lg px-3 py-2 text-sm mb-3 break-all"
              style={{ border: `1px solid ${C.border}`, color: C.textPrimary, fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {inviteUrl}
            </div>
            <button
              onClick={handleInvite}
              className="w-full rounded-xl font-semibold py-3 transition-transform active:scale-95"
              style={{ background: C.teal, color: "#0e0e12" }}
            >
              Share invite link
            </button>
            {inviteNotice && (
              <div className="text-center text-xs mt-2" style={{ color: C.textMuted }}>
                {inviteNotice}
              </div>
            )}
          </div>

          <div className="w-full max-w-4xl grid grid-cols-2 gap-4">
            <div className="rounded-xl p-4 text-sm" style={{ border: `1px solid ${C.border}` }}>
              <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: C.textMuted }}>
                Referred signups
              </div>
              <div className="text-2xl font-semibold" style={{ color: C.textPrimary }}>
                {(profile?.referred_signups_count ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl p-4 text-sm" style={{ border: `1px solid ${C.border}` }}>
              <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: C.textMuted }}>
                Qualified referrals
              </div>
              <div className="text-2xl font-semibold" style={{ color: C.gold }}>
                {(profile?.qualified_referral_count ?? 0).toLocaleString()}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
