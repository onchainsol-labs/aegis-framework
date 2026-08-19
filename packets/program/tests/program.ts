import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Packet } from "../target/types/packet";
import IDL from "../target/idl/packet.json";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  transfer,
} from "@solana/spl-token";
import { expect } from "chai";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const IDL_ERRORS = new Map<number, string>(
  (IDL.errors ?? []).map((e) => [e.code, e.name] as [number, string])
);

function expectAnchorErrorCode(err: unknown, code: string) {
  const e = err as any;
  const got =
    e?.error?.errorCode?.code ??
    (typeof e?.code === "number" ? IDL_ERRORS.get(e.code) : e?.code) ??
    (e?.transactionLogs?.some((l: string) => l.includes("already in use"))
      ? "AccountAlreadyInUse"
      : undefined);
  expect(
    got,
    `expected Anchor error ${code}, got: ${JSON.stringify(e)}`
  ).to.eq(code);
}

async function expectRpcError(code: string, p: Promise<unknown>) {
  try {
    await p;
  } catch (err) {
    expectAnchorErrorCode(err, code);
    return;
  }
  throw new Error(`expected Anchor error ${code}, but the tx succeeded`);
}

describe("packet", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Built directly from the generated IDL — no dependency on how the CLI
  // names the workspace key.
  const program = new Program<Packet>(IDL, provider);
  const conn = provider.connection;

  const FEE_BPS = 100; // 1%
  const admin = provider.wallet.publicKey;

  const feeCollector = anchor.web3.Keypair.generate();
  const creator = anchor.web3.Keypair.generate();
  const claimerA = anchor.web3.Keypair.generate();
  const claimerB = anchor.web3.Keypair.generate();
  const claimerC = anchor.web3.Keypair.generate();
  const claimerD = anchor.web3.Keypair.generate();

  let mint: anchor.web3.PublicKey;
  let creatorAta: anchor.web3.PublicKey;
  let feeCollectorAta: anchor.web3.PublicKey;
  let configPda: anchor.web3.PublicKey;

  async function airdrop(to: anchor.web3.PublicKey, lamports = 2_000_000_000) {
    try {
      const sig = await conn.requestAirdrop(to, lamports);
      await conn.confirmTransaction(sig);
    } catch {
      // Windows localnet: the faucet connects to 0.0.0.0:9900, which Windows
      // rejects. Fall back to a direct transfer from the funded admin wallet.
      const tx = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: provider.wallet.publicKey,
          toPubkey: to,
          lamports,
        })
      );
      await provider.sendAndConfirm(tx);
    }
  }

  async function createPacket(
    total: number,
    limit: number,
    expiresAt: number,
    mode: "equal" | "random" = "equal"
  ): Promise<{ packet: anchor.web3.PublicKey; vault: anchor.web3.PublicKey }> {
    const nonce = anchor.web3.Keypair.generate().publicKey.toBytes();
    const [packet] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("packet"), creator.publicKey.toBytes(), nonce],
      program.programId
    );
    const [vault] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), packet.toBytes()],
      program.programId
    );

    await program.methods
      .createAndFund(
        Array.from(nonce),
        new anchor.BN(total),
        limit,
        mode === "random" ? { random: {} } : { equal: {} },
        new anchor.BN(expiresAt)
      )
      .accountsPartial({
        creator: creator.publicKey,
        creatorAta,
        mint,
        packet,
        vault,
        feeCollectorAta,
        config: configPda,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([creator])
      .rpc();

    return { packet, vault };
  }

  function derivePacketPdas(
    nonce: number[],
    creatorKey: anchor.web3.PublicKey
  ): { packet: anchor.web3.PublicKey; vault: anchor.web3.PublicKey } {
    const [packet] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("packet"), creatorKey.toBytes(), Buffer.from(nonce)],
      program.programId
    );
    const [vault] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), packet.toBytes()],
      program.programId
    );
    return { packet, vault };
  }

  async function claimPacket(
    claimerKp: anchor.web3.Keypair,
    packetPda: anchor.web3.PublicKey,
    vaultPda: anchor.web3.PublicKey
  ) {
    await program.methods
      .claimPacket()
      .accountsPartial({
        claimer: claimerKp.publicKey,
        packet: packetPda,
        vault: vaultPda,
        claimerAta: getAssociatedTokenAddressSync(mint, claimerKp.publicKey),
        mint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([claimerKp])
      .rpc();
  }

  before(async () => {
    await airdrop(admin);
    await airdrop(feeCollector.publicKey);
    await airdrop(creator.publicKey);
    await airdrop(claimerA.publicKey, 1_000_000_000);
    await airdrop(claimerB.publicKey, 1_000_000_000);
    await airdrop(claimerC.publicKey, 1_000_000_000);
    await airdrop(claimerD.publicKey, 1_000_000_000);

    mint = await createMint(
      conn,
      provider.wallet.payer,
      provider.wallet.publicKey,
      null,
      6
    );

    creatorAta = (
      await getOrCreateAssociatedTokenAccount(
        conn,
        provider.wallet.payer,
        mint,
        creator.publicKey
      )
    ).address;

    feeCollectorAta = (
      await getOrCreateAssociatedTokenAccount(
        conn,
        provider.wallet.payer,
        mint,
        feeCollector.publicKey
      )
    ).address;

    // Fund the creator generously for all packet drops + fees in the suite.
    await mintTo(
      conn,
      provider.wallet.payer,
      mint,
      creatorAta,
      provider.wallet.publicKey,
      BigInt(1_000_000_000_000)
    );

    [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );
  });

  // -------------------------------------------------------------------------
  // Config
  // -------------------------------------------------------------------------

  it("initializes the config with the deployer as admin", async () => {
    await program.methods
      .initializeConfig(FEE_BPS, feeCollector.publicKey)
      .accountsPartial({ config: configPda })
      .rpc();

    const cfg = await program.account.config.fetch(configPda);
    expect(cfg.admin.equals(admin)).to.be.true;
    expect(cfg.feeBps).to.eq(FEE_BPS);
    expect(cfg.feeCollector.equals(feeCollector.publicKey)).to.be.true;
  });

  it("rejects a second config initialization", async () => {
    await expectRpcError(
      "AccountAlreadyInUse",
      program.methods
        .initializeConfig(FEE_BPS, feeCollector.publicKey)
        .accountsPartial({ config: configPda })
        .rpc()
    );
  });

  it("rejects config updates above the fee ceiling", async () => {
    await expectRpcError(
      "FeeTooHigh",
      program.methods
        .updateConfig(600, null, null)
        .accountsPartial({ config: configPda })
        .rpc()
    );
  });

  it("rejects config updates from a non-admin", async () => {
    await expectRpcError(
      "Unauthorized",
      program.methods
        .updateConfig(FEE_BPS, null, null)
        .accountsPartial({ config: configPda, admin: claimerA.publicKey })
        .signers([claimerA])
        .rpc()
    );
  });

  // -------------------------------------------------------------------------
  // create_and_fund happy path
  // -------------------------------------------------------------------------

  it("creates and funds a packet, charging the fee on top", async () => {
    const TOTAL = 1_000_000;
    const LIMIT = 3;
    const FEE = (TOTAL * FEE_BPS) / 10_000;

    const creatorBefore = await getAccount(conn, creatorAta);
    const collectorBefore = await getAccount(conn, feeCollectorAta);

    const { packet, vault } = await createPacket(TOTAL, LIMIT, 0);

    const packetAcc = await program.account.packet.fetch(packet);
    expect(packetAcc.creator.equals(creator.publicKey)).to.be.true;
    expect(packetAcc.mint.equals(mint)).to.be.true;
    expect(packetAcc.totalAmount.toNumber()).to.eq(TOTAL);
    expect(packetAcc.remainingAmount.toNumber()).to.eq(TOTAL);
    expect(packetAcc.perClaimAmount.toNumber()).to.eq(Math.floor(TOTAL / LIMIT));
    expect(packetAcc.recipientLimit).to.eq(LIMIT);
    expect(packetAcc.claimCount).to.eq(0);
    expect(packetAcc.mode).to.have.property("equal");
    expect(packetAcc.expiresAt.toNumber()).to.eq(0);
    expect(packetAcc.status).to.have.property("active");
    expect(packetAcc.claims).to.have.length(0);

    // Vault holds the FULL amount; recipients are never shorted by the fee.
    expect((await getAccount(conn, vault)).amount).to.eq(BigInt(TOTAL));

    // Creator paid amount + fee. Collector received exactly the fee.
    const creatorAfter = await getAccount(conn, creatorAta);
    const collectorAfter = await getAccount(conn, feeCollectorAta);
    expect(creatorBefore.amount - creatorAfter.amount).to.eq(
      BigInt(TOTAL + FEE)
    );
    expect(collectorAfter.amount - collectorBefore.amount).to.eq(BigInt(FEE));
  });

  it("rejects invalid create params", async () => {
    // recipient limit out of bounds
    const nonceA: number[] = Array.from(anchor.web3.Keypair.generate().publicKey.toBytes());
    const pdasA = derivePacketPdas(nonceA, creator.publicKey);
    await expectRpcError(
      "InvalidRecipientLimit",
      program.methods
        .createAndFund(nonceA, new anchor.BN(300), 0, { equal: {} }, new anchor.BN(0))
        .accountsPartial({
          creator: creator.publicKey,
          creatorAta,
          mint,
          packet: pdasA.packet,
          vault: pdasA.vault,
          feeCollectorAta,
          config: configPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([creator])
        .rpc()
    );
    const nonceB: number[] = Array.from(anchor.web3.Keypair.generate().publicKey.toBytes());
    const pdasB = derivePacketPdas(nonceB, creator.publicKey);
    await expectRpcError(
      "InvalidRecipientLimit",
      program.methods
        .createAndFund(nonceB, new anchor.BN(300), 101, { equal: {} }, new anchor.BN(0))
        .accountsPartial({
          creator: creator.publicKey,
          creatorAta,
          mint,
          packet: pdasB.packet,
          vault: pdasB.vault,
          feeCollectorAta,
          config: configPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([creator])
        .rpc()
    );

    // amount smaller than the number of recipients
    const nonceC: number[] = Array.from(anchor.web3.Keypair.generate().publicKey.toBytes());
    const pdasC = derivePacketPdas(nonceC, creator.publicKey);
    await expectRpcError(
      "AmountTooSmall",
      program.methods
        .createAndFund(nonceC, new anchor.BN(2), 3, { equal: {} }, new anchor.BN(0))
        .accountsPartial({
          creator: creator.publicKey,
          creatorAta,
          mint,
          packet: pdasC.packet,
          vault: pdasC.vault,
          feeCollectorAta,
          config: configPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([creator])
        .rpc()
    );

    // random mode not shipped yet
    const nonceD: number[] = Array.from(anchor.web3.Keypair.generate().publicKey.toBytes());
    const pdasD = derivePacketPdas(nonceD, creator.publicKey);
    await expectRpcError(
      "RandomNotSupported",
      program.methods
        .createAndFund(nonceD, new anchor.BN(300), 3, { random: {} }, new anchor.BN(0))
        .accountsPartial({
          creator: creator.publicKey,
          creatorAta,
          mint,
          packet: pdasD.packet,
          vault: pdasD.vault,
          feeCollectorAta,
          config: configPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([creator])
        .rpc()
    );

    // expiry in the past
    const nonceE: number[] = Array.from(anchor.web3.Keypair.generate().publicKey.toBytes());
    const pdasE = derivePacketPdas(nonceE, creator.publicKey);
    await expectRpcError(
      "InvalidExpiry",
      program.methods
        .createAndFund(
          nonceE,
          new anchor.BN(300),
          3,
          { equal: {} },
          new anchor.BN(Math.floor(Date.now() / 1000) - 60)
        )
        .accountsPartial({
          creator: creator.publicKey,
          creatorAta,
          mint,
          packet: pdasE.packet,
          vault: pdasE.vault,
          feeCollectorAta,
          config: configPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([creator])
        .rpc()
    );
  });

  it("rejects a drop when the fee collector ATA does not exist", async () => {
    // Use a fresh mint that has no fee-collector ATA yet: the drop must fail.
    const mint2 = await createMint(
      conn,
      provider.wallet.payer,
      provider.wallet.publicKey,
      null,
      6
    );
    const creatorAta2 = (
      await getOrCreateAssociatedTokenAccount(
        conn,
        provider.wallet.payer,
        mint2,
        creator.publicKey
      )
    ).address;
    const missingAta = getAssociatedTokenAddressSync(
      mint2,
      feeCollector.publicKey
    );

    const nonce: number[] = Array.from(anchor.web3.Keypair.generate().publicKey.toBytes());
    const { packet, vault } = derivePacketPdas(nonce, creator.publicKey);

    await expectRpcError(
      "AccountNotInitialized",
      program.methods
        .createAndFund(nonce, new anchor.BN(300), 3, { equal: {} }, new anchor.BN(0))
        .accountsPartial({
          creator: creator.publicKey,
          creatorAta: creatorAta2,
          mint: mint2,
          packet,
          vault,
          feeCollectorAta: missingAta,
          config: configPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([creator])
        .rpc()
    );
  });

  // -------------------------------------------------------------------------
  // Claims: full happy path + attack paths
  // -------------------------------------------------------------------------

  it("pays per_claim to each claimer and dust to the final claimer", async () => {
    const { packet, vault } = await createPacket(1_000_000, 3, 0);
    const ataA = getAssociatedTokenAddressSync(mint, claimerA.publicKey);
    const ataB = getAssociatedTokenAddressSync(mint, claimerB.publicKey);
    const ataC = getAssociatedTokenAddressSync(mint, claimerC.publicKey);

    // Claimer A: fixed share
    await claimPacket(claimerA, packet, vault);
    expect((await getAccount(conn, ataA)).amount).to.eq(BigInt(333_333));

    let packetAcc = await program.account.packet.fetch(packet);
    expect(packetAcc.claimCount).to.eq(1);
    expect(packetAcc.remainingAmount.toNumber()).to.eq(666_667);
    expect(packetAcc.status).to.have.property("active");

    // Claimer A again: double claim blocked
    await expectRpcError(
      "AlreadyClaimed",
      program.methods
        .claimPacket()
        .accountsPartial({
          claimer: claimerA.publicKey,
          packet,
          vault,
          claimerAta: ataA,
          mint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([claimerA])
        .rpc()
    );

    // Claimer B: fixed share
    await claimPacket(claimerB, packet, vault);
    expect((await getAccount(conn, ataB)).amount).to.eq(BigInt(333_333));

    // Claimer C: final claimant sweeps the remainder (no dust)
    await claimPacket(claimerC, packet, vault);
    expect((await getAccount(conn, ataC)).amount).to.eq(BigInt(333_334));

    packetAcc = await program.account.packet.fetch(packet);
    expect(packetAcc.claimCount).to.eq(3);
    expect(packetAcc.remainingAmount.toNumber()).to.eq(0);
    expect(packetAcc.status).to.have.property("completed");
    expect((await getAccount(conn, vault)).amount).to.eq(BigInt(0));

    // Claimer D: packet is closed for claims
    await expectRpcError(
      "NotActive",
      program.methods
        .claimPacket()
        .accountsPartial({
          claimer: claimerD.publicKey,
          packet,
          vault,
          claimerAta: getAssociatedTokenAddressSync(mint, claimerD.publicKey),
          mint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([claimerD])
        .rpc()
    );
  });

  it("blocks claims on an expired packet", async () => {
    const { packet, vault } = await createPacket(
      300,
      3,
      Math.floor(Date.now() / 1000) + 2
    );

    await sleep(3000);

    await expectRpcError(
      "Expired",
      program.methods
        .claimPacket()
        .accountsPartial({
          claimer: claimerA.publicKey,
          packet,
          vault,
          claimerAta: getAssociatedTokenAddressSync(mint, claimerA.publicKey),
          mint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([claimerA])
        .rpc()
    );
  });

  // -------------------------------------------------------------------------
  // Refunds
  // -------------------------------------------------------------------------

  it("refuses refunds before expiry or completion", async () => {
    const { packet, vault } = await createPacket(300, 3, 0);

    // Only the creator can refund
    await expectRpcError(
      "Unauthorized",
      program.methods
        .refundPacket()
        .accountsPartial({
          creator: claimerA.publicKey,
          packet,
          vault,
          creatorAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([claimerA])
        .rpc()
    );

    // Creator, but the packet is still active and never expires
    await expectRpcError(
      "NotRefundable",
      program.methods
        .refundPacket()
        .accountsPartial({
          creator: creator.publicKey,
          packet,
          vault,
          creatorAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([creator])
        .rpc()
    );
  });

  it("returns the unclaimed remainder and closes both accounts on refund", async () => {
    const { packet, vault } = await createPacket(
      300,
      3,
      Math.floor(Date.now() / 1000) + 2
    );
    await claimPacket(claimerA, packet, vault);

    await sleep(3000);

    const creatorBefore = await getAccount(conn, creatorAta);
    await program.methods
      .refundPacket()
      .accountsPartial({
        creator: creator.publicKey,
        packet,
        vault,
        creatorAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([creator])
      .rpc();
    const creatorAfter = await getAccount(conn, creatorAta);

    // 200 of the 300 remain (claimer A took 100)
    expect(creatorAfter.amount - creatorBefore.amount).to.eq(BigInt(200));

    // Both accounts are closed and rent returned
    expect(await conn.getAccountInfo(vault)).to.be.null;
    expect(await conn.getAccountInfo(packet)).to.be.null;
  });

  it("sweeps donated tokens to the creator so refunds can't be griefed", async () => {
    const { packet, vault } = await createPacket(
      300,
      3,
      Math.floor(Date.now() / 1000) + 2
    );
    await claimPacket(claimerB, packet, vault);

    // Griefer sends 50 tokens straight to the vault PDA.
    await transfer(
      conn,
      creator,
      creatorAta,
      vault,
      creator.publicKey,
      BigInt(50)
    );

    await sleep(3000);

    const creatorBefore = await getAccount(conn, creatorAta);
    await program.methods
      .refundPacket()
      .accountsPartial({
        creator: creator.publicKey,
        packet,
        vault,
        creatorAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([creator])
      .rpc();
    const creatorAfter = await getAccount(conn, creatorAta);

    // 200 unclaimed + 50 donated — full balance sweep, close succeeds.
    expect(creatorAfter.amount - creatorBefore.amount).to.eq(BigInt(250));
    expect(await conn.getAccountInfo(vault)).to.be.null;
    expect(await conn.getAccountInfo(packet)).to.be.null;
  });

  it("refuses a refund when the vault is already empty", async () => {
    // Fully claimed packet: nothing left in the vault.
    const { packet, vault } = await createPacket(300, 3, 0);
    await claimPacket(claimerA, packet, vault);
    await claimPacket(claimerB, packet, vault);
    await claimPacket(claimerC, packet, vault);

    await expectRpcError(
      "NothingToRefund",
      program.methods
        .refundPacket()
        .accountsPartial({
          creator: creator.publicKey,
          packet,
          vault,
          creatorAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([creator])
        .rpc()
    );
  });

  // -------------------------------------------------------------------------
  // Fee config edge cases
  // -------------------------------------------------------------------------

  it("charges no fee when the config fee is zero", async () => {
    await program.methods
      .updateConfig(0, null, null)
      .accountsPartial({ config: configPda })
      .rpc();

    const collectorBefore = await getAccount(conn, feeCollectorAta);
    const creatorBefore = await getAccount(conn, creatorAta);

    await createPacket(300, 3, 0);

    const collectorAfter = await getAccount(conn, feeCollectorAta);
    const creatorAfter = await getAccount(conn, creatorAta);
    expect(collectorAfter.amount).to.eq(collectorBefore.amount);
    expect(creatorBefore.amount - creatorAfter.amount).to.eq(BigInt(300));

    // Restore the fee for any future packets.
    await program.methods
      .updateConfig(FEE_BPS, null, null)
      .accountsPartial({ config: configPda })
      .rpc();
  });
});
