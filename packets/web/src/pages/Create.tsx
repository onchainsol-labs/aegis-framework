import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Minus, Plus, Scale, Dices } from "lucide-react";
import { packetClient, feeFor } from "../lib/packetClient";
import type { CreatePacketInput, DistributionMode } from "../lib/types";
import { formatUsd, formatInputAmount } from "../lib/format";
import { usePacketWallet } from "../lib/walletProvider";

const TOKENS = [
  { symbol: "USDC", available: true },
  { symbol: "SOL", available: false },
  { symbol: "SKR", available: false },
];

const EXPIRY_OPTIONS = [
  { label: "1 hour", ms: 60 * 60_000 },
  { label: "6 hours", ms: 6 * 60 * 60_000 },
  { label: "24 hours", ms: 24 * 60 * 60_000 },
  { label: "Never", ms: null },
];

const STEPS = ["Amount", "Recipients", "Split", "Expiry", "Review"];

export function Create() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const { identity, getBalance } = usePacketWallet();
  // The slide-in is for step changes only — the page itself should just
  // appear, like Home and History.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);

  // Real USDC balance from the chain (via siws → Helius RPC).
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!identity) {
      setBalance(null);
      return () => {
        cancelled = true;
      };
    }
    getBalance()
      .then((b) => {
        if (!cancelled) setBalance(b.usdc);
      })
      .catch(() => {
        if (!cancelled) setBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [identity, getBalance]);

  const [step, setStep] = useState(0);
  const [symbol, setSymbol] = useState("USDC");
  const [amountText, setAmountText] = useState("100");
  const [recipientsText, setRecipientsText] = useState("10");
  const [mode, setMode] = useState<DistributionMode>("equal");
  const [expiryMs, setExpiryMs] = useState<number | null>(EXPIRY_OPTIONS[0].ms);
  const [error, setError] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);

  const amount = Number.parseFloat(amountText);
  const amountValid = Number.isFinite(amount) && amount > 0;

  // Recipients: typeable (1–100), steppers still work for small numbers.
  const recipientsNum = Number.parseInt(recipientsText, 10);
  const recipientsValid =
    recipientsText.length > 0 && !Number.isNaN(recipientsNum) && recipientsNum >= 1 && recipientsNum <= 100;
  const recipients = recipientsValid ? recipientsNum : 10;

  const perClaim = amountValid ? Math.floor((amount / recipients) * 100) / 100 : 0;
  const fee = amountValid ? feeFor(amount) : 0;

  // The amount shrinks gracefully as digits grow so it never spills out.
  const displayedAmount = formatInputAmount(amountText);
  const digitCount = amountText.replace(".", "").length;
  const amountSize =
    digitCount <= 4
      ? "text-6xl"
      : digitCount <= 6
        ? "text-5xl"
        : digitCount <= 8
          ? "text-4xl"
          : digitCount <= 10
            ? "text-3xl"
            : "text-2xl";
  const dollarSize = digitCount <= 4 ? "text-3xl" : digitCount <= 6 ? "text-2xl" : "text-xl";

  const next = () => {
    if (step === 0 && !amountValid) {
      setError("Enter an amount to continue.");
      return;
    }
    if (step === 1 && !recipientsValid) {
      setError("Enter between 1 and 100 people.");
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const drop = async () => {
    const input: CreatePacketInput = {
      symbol,
      totalAmount: amount,
      recipientLimit: recipients,
      mode,
      expiresAt: expiryMs == null ? null : Date.now() + expiryMs,
    };
    setDropping(true);
    setError(null);
    try {
      const packet = await packetClient.createPacket(input);
      navigate(`/p/${packet.id}?justDropped=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setDropping(false);
    }
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="mx-auto max-w-md">
      {/* Stepper header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {step > 0 ? (
            <button type="button" onClick={back} aria-label="Go back" className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-ink/5">
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : (
            <span className="h-10 w-10" />
          )}
          <h1 className="text-lg font-black text-ink">Drop a Packet</h1>
          <span className="flex h-10 items-center text-sm font-extrabold text-ink-soft">{step + 1}/{STEPS.length}</span>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          <motion.div
            className="h-full rounded-full bg-gold"
            animate={{ width: `${progress}%` }}
            transition={{ duration: reduced ? 0 : 0.3, ease: "easeOut" }}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-2xl border-2 border-envelope/30 bg-white p-3 text-sm font-bold text-envelope-deep">
          {error}
        </p>
      )}

      <motion.div
        key={step}
        initial={!mounted.current ? false : reduced ? false : { opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {/* Step 0 — amount */}
        {step === 0 && (
          <section aria-label="How much">
            <h2 className="text-center text-sm font-bold text-ink-soft">How much?</h2>
            <div className="mt-3 rounded-3xl bg-white p-6 shadow-card">
              <label htmlFor="amount" className="sr-only">Amount</label>
              <div className="flex w-full items-baseline justify-center gap-1.5 overflow-hidden px-2">
                <span className={`shrink-0 font-black text-ink-soft ${dollarSize}`}>$</span>
                <input
                  id="amount"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  maxLength={16}
                  autoFocus
                  value={displayedAmount}
                  onChange={(e) => {
                    const v = e.target.value.replace(/,/g, "");
                    if (/^\d*\.?\d*$/.test(v)) setAmountText(v);
                  }}
                  className={`min-w-0 max-w-full bg-transparent text-center font-black text-ink outline-none transition-all placeholder:text-ink/20 ${amountSize}`}
                  style={{ width: `${Math.min(displayedAmount.length + 2, 15)}ch` }}
                  placeholder="0"
                />
              </div>
              <div className="mt-5 flex justify-center gap-2" role="group" aria-label="Token">
                {TOKENS.map((t) => (
                  <button
                    key={t.symbol}
                    type="button"
                    disabled={!t.available}
                    onClick={() => setSymbol(t.symbol)}
                    aria-pressed={symbol === t.symbol}
                    className={`relative inline-flex h-11 items-center gap-1 rounded-full px-4 text-sm font-extrabold transition-colors ${
                      symbol === t.symbol
                        ? "bg-envelope text-cream"
                        : t.available
                          ? "border-2 border-ink/10 bg-white text-ink hover:border-ink/20"
                          : "cursor-not-allowed border-2 border-ink/5 bg-ink/5 text-ink-soft"
                    }`}
                  >
                    {t.symbol}
                    {!t.available && <span className="text-[10px] font-bold opacity-70">soon</span>}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-center text-xs font-semibold text-ink-soft">
                {identity
                  ? balance != null
                    ? `Balance: ${formatUsd(balance)} USDC`
                    : "Loading balance…"
                  : "Connect a wallet to see your balance"}
              </p>
            </div>
          </section>
        )}

        {/* Step 1 — recipients */}
        {step === 1 && (
          <section aria-label="How many people">
            <h2 className="text-center text-sm font-bold text-ink-soft">How many people?</h2>
            <div className="mt-3 rounded-3xl bg-white p-6 shadow-card">
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setRecipientsText(String(Math.max(1, recipients - 1)))}
                  aria-label="Fewer people"
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-ink/10 text-ink transition-colors hover:border-ink/25 active:scale-95"
                >
                  <Minus className="h-5 w-5" aria-hidden="true" />
                </button>
                <div className="w-32 text-center">
                  <label htmlFor="recipients" className="sr-only">Number of people</label>
                  <input
                    id="recipients"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={3}
                    value={recipientsText}
                    onChange={(e) => {
                      if (/^\d{0,3}$/.test(e.target.value)) setRecipientsText(e.target.value);
                    }}
                    onBlur={() => {
                      if (!recipientsValid) setRecipientsText(String(Math.min(100, Math.max(1, recipientsNum || 10))));
                    }}
                    className="w-full bg-transparent text-center text-5xl font-black text-ink outline-none placeholder:text-ink/20"
                    placeholder="10"
                    aria-live="polite"
                  />
                  <span className="block text-sm font-bold text-ink-soft">people</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRecipientsText(String(Math.min(100, recipients + 1)))}
                  aria-label="More people"
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-ink/10 text-ink transition-colors hover:border-ink/25 active:scale-95"
                >
                  <Plus className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <p className="mt-5 text-center text-sm font-bold text-ink-soft">
                Each gets <span className="text-ink">{formatUsd(perClaim)}</span> if Equal
                <span className="block text-xs font-semibold opacity-80">Random = luck, 0.5×–2×</span>
              </p>
            </div>
          </section>
        )}

        {/* Step 2 — mode */}
        {step === 2 && (
          <section aria-label="How is it split">
            <h2 className="text-center text-sm font-bold text-ink-soft">How is it split?</h2>
            <div className="mt-3 space-y-3">
              <button
                type="button"
                onClick={() => setMode("equal")}
                aria-pressed={mode === "equal"}
                className={`flex w-full items-center gap-4 rounded-3xl p-5 text-left transition-all ${
                  mode === "equal" ? "bg-envelope text-cream shadow-envelope" : "bg-white shadow-card hover:shadow-lg"
                }`}
              >
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${mode === "equal" ? "bg-cream/15" : "bg-gold/20"}`}>
                  <Scale className="h-6 w-6" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-lg font-black">Equal</span>
                  <span className={`block text-sm font-semibold ${mode === "equal" ? "text-cream/85" : "text-ink-soft"}`}>
                    Everyone gets {formatUsd(perClaim)}
                  </span>
                </span>
                <span className={`ml-auto flex h-6 w-6 items-center justify-center rounded-full border-2 ${mode === "equal" ? "border-cream" : "border-ink/20"}`}>
                  {mode === "equal" && <span className="h-3 w-3 rounded-full bg-cream" />}
                </span>
              </button>

              <button
                type="button"
                disabled
                aria-pressed={mode === "random"}
                className="flex w-full cursor-not-allowed items-center gap-4 rounded-3xl bg-white p-5 text-left opacity-60 shadow-card"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold/20">
                  <Dices className="h-6 w-6" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-lg font-black">Random</span>
                  <span className="block text-sm font-semibold text-ink-soft">Luck! Shares vary</span>
                </span>
                <span className="ml-auto rounded-full bg-gold px-3 py-1 text-xs font-black text-ink">Soon</span>
              </button>
            </div>
          </section>
        )}

        {/* Step 3 — expiry */}
        {step === 3 && (
          <section aria-label="Expires in">
            <h2 className="text-center text-sm font-bold text-ink-soft">Expires in?</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {EXPIRY_OPTIONS.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setExpiryMs(o.ms)}
                  aria-pressed={expiryMs === o.ms}
                  className={`rounded-3xl px-4 py-5 text-center text-lg font-black transition-all ${
                    expiryMs === o.ms ? "bg-envelope text-cream shadow-envelope" : "bg-white shadow-card hover:shadow-lg"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-ink-soft">
              <span aria-hidden="true">🪙</span> Unclaimed money returns to you.
            </p>
          </section>
        )}

        {/* Step 4 — review */}
        {step === 4 && (
          <section aria-label="Review and drop" className="sm:grid sm:grid-cols-2 sm:items-stretch sm:gap-4">
            <div className="flex flex-col justify-center rounded-3xl bg-white p-6 text-center shadow-card">
              <p className="text-4xl" aria-hidden="true">🧧</p>
              <p className="mt-1 text-2xl font-black text-ink">{formatUsd(amount)}</p>
              <p className="text-sm font-bold text-ink-soft">
                {recipients} people · {mode === "equal" ? "Equal" : "Random"} · {EXPIRY_OPTIONS.find((o) => o.ms === expiryMs)?.label ?? "Never"} · {symbol}
              </p>
            </div>
            <dl className="mt-4 flex flex-col justify-center space-y-2 rounded-3xl bg-white p-5 text-sm shadow-card sm:mt-0">
              <div className="flex justify-between font-bold text-ink-soft">
                <dt>Packet amount</dt>
                <dd>{formatUsd(amount)}</dd>
              </div>
              <div className="flex justify-between font-bold text-ink-soft">
                <dt>Fee (1%)</dt>
                <dd>+{formatUsd(fee)}</dd>
              </div>
              <div className="flex justify-between border-t border-ink/10 pt-2 text-base font-black text-ink">
                <dt>You pay</dt>
                <dd>{formatUsd(amount + fee)}</dd>
              </div>
            </dl>
          </section>
        )}
      </motion.div>

      {/* Footer actions */}
      <div className="mt-8">
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={next}
            className="flex w-full items-center justify-center gap-2 rounded-3xl bg-envelope px-6 py-4 text-base font-black text-cream shadow-float transition-colors hover:bg-envelope-deep active:scale-[0.99]"
          >
            Continue <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void drop()}
            disabled={dropping}
            className="flex w-full items-center justify-center gap-2 rounded-3xl bg-envelope px-6 py-4 text-base font-black text-cream shadow-float transition-all hover:bg-envelope-deep active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
          >
            {dropping ? "Dropping…" : "✨ Drop Packet"}
          </button>
        )}
      </div>
    </div>
  );
}
