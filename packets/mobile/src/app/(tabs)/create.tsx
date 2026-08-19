import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ArrowLeft, ArrowRight, Dices, Minus, Plus, Scale } from "lucide-react-native";
import { packetClient, feeFor } from "../../lib/packetClient";
import type { CreatePacketInput, DistributionMode } from "../../lib/types";
import { formatUsd, formatInputAmount } from "../../lib/format";
import { usePacketWallet } from "../../lib/walletProvider";

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

export default function Create() {
  const router = useRouter();
  const { identity, getBalance } = usePacketWallet();

  // Real USDC balance from the chain (RPC).
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
      router.replace(`/p/${packet.id}?justDropped=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setDropping(false);
    }
  };

  const progress = ((step + 1) / STEPS.length) * 100;
  const stepRef = useRef(step);
  stepRef.current = step;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 40,
          paddingTop: 24,
          width: "100%",
          maxWidth: 448,
          alignSelf: "center",
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Stepper header */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between">
            {step > 0 ? (
              <Pressable onPress={back} aria-label="Go back" className="h-10 w-10 items-center justify-center rounded-xl active:bg-ink/5">
                <ArrowLeft size={20} color="#6B6257" />
              </Pressable>
            ) : (
              <View className="h-10 w-10" />
            )}
            <Text className="text-lg font-black text-ink">Drop a Packet</Text>
            <Text className="h-10 text-center text-sm font-extrabold leading-10 text-ink-soft">
              {step + 1}/{STEPS.length}
            </Text>
          </View>
          <View className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
            <View className="h-full rounded-full bg-gold" style={{ width: `${progress}%` }} />
          </View>
        </View>

        {error && (
          <Text className="mb-4 rounded-2xl border-2 border-envelope/30 bg-white p-3 text-sm font-bold text-envelope-deep">
            {error}
          </Text>
        )}

        {/* Step 0 — amount */}
        {step === 0 && (
          <View>
            <Text className="text-center text-sm font-bold text-ink-soft">How much?</Text>
            <View className="mt-3 rounded-3xl bg-white p-6 shadow-card">
              <View className="w-full flex-row items-baseline justify-center gap-1.5 overflow-hidden px-2">
                <Text className={`shrink-0 font-black text-ink-soft ${dollarSize}`}>$</Text>
                <TextInput
                  value={displayedAmount}
                  onChangeText={(v) => {
                    const raw = v.replace(/,/g, "");
                    if (/^\d*\.?\d*$/.test(raw)) setAmountText(raw);
                  }}
                  keyboardType="decimal-pad"
                  autoFocus
                  maxLength={16}
                  placeholder="0"
                  placeholderTextColor="rgba(31,27,22,0.2)"
                  className={`min-w-0 max-w-full bg-transparent text-center font-black text-ink ${amountSize}`}
                  style={{ minWidth: 60 }}
                />
              </View>
              <View className="mt-5 flex-row justify-center gap-2">
                {TOKENS.map((t) => (
                  <Pressable
                    key={t.symbol}
                    disabled={!t.available}
                    onPress={() => setSymbol(t.symbol)}
                    aria-pressed={symbol === t.symbol}
                    className={`h-11 flex-row items-center gap-1 rounded-full px-4 ${
                      symbol === t.symbol
                        ? "bg-envelope"
                        : t.available
                          ? "border-2 border-ink/10 bg-white"
                          : "border-2 border-ink/5 bg-ink/5"
                    }`}
                  >
                    <Text
                      className={`text-sm font-extrabold ${
                        symbol === t.symbol ? "text-cream" : t.available ? "text-ink" : "text-ink-soft"
                      }`}
                    >
                      {t.symbol}
                    </Text>
                    {!t.available && <Text className="text-[10px] font-bold opacity-70">soon</Text>}
                  </Pressable>
                ))}
              </View>
              <Text className="mt-4 text-center text-xs font-semibold text-ink-soft">
                {identity
                  ? balance != null
                    ? `Balance: ${formatUsd(balance)} USDC`
                    : "Loading balance…"
                  : "Connect a wallet to see your balance"}
              </Text>
            </View>
          </View>
        )}

        {/* Step 1 — recipients */}
        {step === 1 && (
          <View>
            <Text className="text-center text-sm font-bold text-ink-soft">How many people?</Text>
            <View className="mt-3 rounded-3xl bg-white p-6 shadow-card">
              <View className="flex-row items-center justify-center gap-4">
                <Pressable
                  onPress={() => setRecipientsText(String(Math.max(1, recipients - 1)))}
                  aria-label="Fewer people"
                  className="h-12 w-12 items-center justify-center rounded-2xl border-2 border-ink/10 active:scale-95"
                >
                  <Minus size={20} color="#1F1B16" />
                </Pressable>
                <View className="w-32 items-center">
                  <TextInput
                    value={recipientsText}
                    onChangeText={(v) => {
                      if (/^\d{0,3}$/.test(v)) setRecipientsText(v);
                    }}
                    onBlur={() => {
                      if (!recipientsValid)
                        setRecipientsText(String(Math.min(100, Math.max(1, recipientsNum || 10))));
                    }}
                    keyboardType="number-pad"
                    maxLength={3}
                    placeholder="10"
                    placeholderTextColor="rgba(31,27,22,0.2)"
                    className="w-full bg-transparent text-center text-5xl font-black text-ink"
                  />
                  <Text className="text-sm font-bold text-ink-soft">people</Text>
                </View>
                <Pressable
                  onPress={() => setRecipientsText(String(Math.min(100, recipients + 1)))}
                  aria-label="More people"
                  className="h-12 w-12 items-center justify-center rounded-2xl border-2 border-ink/10 active:scale-95"
                >
                  <Plus size={20} color="#1F1B16" />
                </Pressable>
              </View>
              <Text className="mt-5 text-center text-sm font-bold text-ink-soft">
                Each gets <Text className="text-ink">{formatUsd(perClaim)}</Text> if Equal
                <Text className="text-xs font-semibold opacity-80">{"\n"}Random = luck, 0.5×–2×</Text>
              </Text>
            </View>
          </View>
        )}

        {/* Step 2 — mode */}
        {step === 2 && (
          <View>
            <Text className="text-center text-sm font-bold text-ink-soft">How is it split?</Text>
            <View className="mt-3 gap-3">
              <Pressable
                onPress={() => setMode("equal")}
                aria-pressed={mode === "equal"}
                className={`flex w-full flex-row items-center gap-4 rounded-3xl p-5 ${mode === "equal" ? "bg-envelope shadow-envelope" : "bg-white shadow-card"}`}
              >
                <View className={`h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${mode === "equal" ? "bg-cream/15" : "bg-gold/20"}`}>
                  <Scale size={24} color={mode === "equal" ? "#FFF7EC" : "#1F1B16"} />
                </View>
                <View>
                  <Text className={`text-lg font-black ${mode === "equal" ? "text-cream" : "text-ink"}`}>Equal</Text>
                  <Text className={`text-sm font-semibold ${mode === "equal" ? "text-cream/85" : "text-ink-soft"}`}>
                    Everyone gets {formatUsd(perClaim)}
                  </Text>
                </View>
                <View className={`ml-auto h-6 w-6 items-center justify-center rounded-full border-2 ${mode === "equal" ? "border-cream" : "border-ink/20"}`}>
                  {mode === "equal" && <View className="h-3 w-3 rounded-full bg-cream" />}
                </View>
              </Pressable>

              <Pressable disabled aria-pressed={mode === "random"} className="flex w-full flex-row items-center gap-4 rounded-3xl bg-white p-5 opacity-60 shadow-card">
                <View className="h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold/20">
                  <Dices size={24} color="#1F1B16" />
                </View>
                <View>
                  <Text className="text-lg font-black text-ink">Random</Text>
                  <Text className="text-sm font-semibold text-ink-soft">Luck! Shares vary</Text>
                </View>
                <View className="ml-auto rounded-full bg-gold px-3 py-1">
                  <Text className="text-xs font-black text-ink">Soon</Text>
                </View>
              </Pressable>
            </View>
          </View>
        )}

        {/* Step 3 — expiry */}
        {step === 3 && (
          <View>
            <Text className="text-center text-sm font-bold text-ink-soft">Expires in?</Text>
            <View className="mt-3 flex-row flex-wrap gap-3">
              {EXPIRY_OPTIONS.map((o) => (
                <Pressable
                  key={o.label}
                  onPress={() => setExpiryMs(o.ms)}
                  aria-pressed={expiryMs === o.ms}
                  className={`min-w-[45%] flex-1 rounded-3xl px-4 py-5 ${expiryMs === o.ms ? "bg-envelope shadow-envelope" : "bg-white shadow-card"}`}
                >
                  <Text className={`text-center text-lg font-black ${expiryMs === o.ms ? "text-cream" : "text-ink"}`}>
                    {o.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text className="mt-4 text-center text-sm font-semibold text-ink-soft">
              🪙 Unclaimed money returns to you.
            </Text>
          </View>
        )}

        {/* Step 4 — review */}
        {step === 4 && (
          <View>
            <View className="items-center justify-center rounded-3xl bg-white p-6 shadow-card">
              <Text className="text-4xl">🧧</Text>
              <Text className="mt-1 text-2xl font-black text-ink">{formatUsd(amount)}</Text>
              <Text className="text-sm font-bold text-ink-soft">
                {recipients} people · {mode === "equal" ? "Equal" : "Random"} ·{" "}
                {EXPIRY_OPTIONS.find((o) => o.ms === expiryMs)?.label ?? "Never"} · {symbol}
              </Text>
            </View>
            <View className="mt-4 gap-2 rounded-3xl bg-white p-5 shadow-card">
              <View className="flex-row justify-between">
                <Text className="text-sm font-bold text-ink-soft">Packet amount</Text>
                <Text className="text-sm font-bold text-ink-soft">{formatUsd(amount)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm font-bold text-ink-soft">Fee (1%)</Text>
                <Text className="text-sm font-bold text-ink-soft">+{formatUsd(fee)}</Text>
              </View>
              <View className="flex-row justify-between border-t border-ink/10 pt-2">
                <Text className="text-base font-black text-ink">You pay</Text>
                <Text className="text-base font-black text-ink">{formatUsd(amount + fee)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Footer actions */}
        <View className="mt-8">
          {step < STEPS.length - 1 ? (
            <Pressable onPress={next} className="w-full flex-row items-center justify-center gap-2 rounded-3xl bg-envelope px-6 py-4 active:scale-[0.99]">
              <Text className="text-base font-black text-cream">Continue</Text>
              <ArrowRight size={20} color="#FFF7EC" />
            </Pressable>
          ) : (
            <Pressable onPress={() => void drop()} disabled={dropping} className="w-full flex-row items-center justify-center gap-2 rounded-3xl bg-envelope px-6 py-4 active:scale-[0.99] disabled:opacity-70">
              <Text className="text-base font-black text-cream">{dropping ? "Dropping…" : "✨ Drop Packet"}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
