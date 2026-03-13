export default function LoginPage() {
  return (
    <main className="safe-screen flex items-center justify-center bg-[var(--sidebar)] px-4 py-8 text-foreground">
      <div className="w-full max-w-md rounded-3xl border border-white/5 bg-card p-6 shadow-2xl shadow-black/20">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-white/50">Tyrano World</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">Enter quietly.</h1>
          <p className="mt-2 text-sm text-white/40">
            Anonymous chat for the conversations you do not want tied to your name.
          </p>
        </div>

        <form className="mt-8 space-y-5">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-white/50">
              Room code
            </label>
            <input
              placeholder="room-tyrano"
              className="mt-2 h-12 w-full rounded-2xl border border-transparent bg-white/5 px-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[color:var(--accent)]/50"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-white/50">
              Display name
            </label>
            <input
              placeholder="Optional nickname"
              className="mt-2 h-12 w-full rounded-2xl border border-transparent bg-white/5 px-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[color:var(--accent)]/50"
            />
          </div>

          <button
            type="submit"
            className="h-14 w-full rounded-2xl bg-[var(--accent)] text-lg font-black text-white shadow-lg shadow-[color:var(--accent)]/20"
          >
            Join Room
          </button>
        </form>

        <p className="mt-6 text-sm text-white/30">
          Anonymous nickname is generated automatically if you leave the name blank.
        </p>
      </div>
    </main>
  );
}
